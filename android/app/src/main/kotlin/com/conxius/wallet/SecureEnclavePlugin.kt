package com.conxius.wallet

import com.conxius.wallet.bitcoin.EvmSigner
import com.conxius.wallet.bitcoin.LiquidSigner
import com.conxius.wallet.bitcoin.Musig2Signer
import com.conxius.wallet.bitcoin.NostrSigner
import com.conxius.wallet.bitcoin.Secp256k1Signer
import com.conxius.wallet.bitcoin.StacksSigner
import com.conxius.wallet.bitcoin.TaprootSigner
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.bouncycastle.util.encoders.Hex
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom

/**
 * Non-custodial value-signing boundary.
 *
 * Backs the `SecureEnclave` Capacitor plugin that the TypeScript layer calls for public-key
 * derivation, PSBT sighash signing, and transaction broadcast. The mnemonic is borrowed from
 * Room/StrongBox only for the duration of a single call (see [RoomWalletSeedProvider]) and is
 * wiped by that provider. No secret material ever crosses to JavaScript.
 */
@CapacitorPlugin(name = "SecureEnclave")
class SecureEnclavePlugin : Plugin() {
    private companion object {
        const val EVM_DEFAULT_PATH = "m/44'/60'/0'/0/0"
        const val STACKS_DEFAULT_PATH = "m/44'/5757'/0'/0/0"
        const val LIQUID_DEFAULT_PATH = "m/84'/0'/0'/0/0"
        const val TAPROOT_DEFAULT_PATH = "m/86'/0'/0'/0/0"
        const val NOSTR_DEFAULT_PATH = "m/44'/1237'/0'/0/0"
    }

    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val app: ConxiusApplication?
        get() = activity?.application as? ConxiusApplication

    private fun reject(call: PluginCall, message: String) {
        call.reject(message)
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val strongBox = app?.strongBoxManager?.isStrongBoxSupported() ?: false
        val ret = JSObject()
        ret.put("available", strongBox)
        call.resolve(ret)
    }

    @PluginMethod
    fun getSecurityLevel(call: PluginCall) {
        val strongBoxManager = app?.strongBoxManager
        val isStrongBox = strongBoxManager?.isStrongBoxSupported() ?: false
        val ret = JSObject()
        ret.put("level", if (isStrongBox) "STRONGBOX" else "TEE")
        ret.put("isStrongBox", isStrongBox)
        call.resolve(ret)
    }

    @PluginMethod
    fun getPublicKey(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: "m/84'/0'/0'/0/0"
        val network = call.getString("network") ?: "mainnet"
        pluginScope.launch {
            try {
                val pubkeyHex = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    derivePublicKeyHex(mnemonic, path, network)
                }
                val ret = JSObject()
                ret.put("pubkey", pubkeyHex)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "public key derivation failed")
            }
        }
    }

    @PluginMethod
    fun signBatch(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: "m/84'/0'/0'/0/0"
        val network = call.getString("network") ?: "mainnet"
        val hashes = call.getArray("hashes")
        if (hashes == null || hashes.length() == 0) {
            return reject(call, "hashes required")
        }
        val hashHexList = (0 until hashes.length()).map { index ->
            hashes.getString(index) ?: return reject(call, "invalid hash at $index")
        }
        pluginScope.launch {
            try {
                val signatures = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    signHashes(mnemonic, path, network, hashHexList)
                }
                val ret = JSObject()
                ret.put("signatures", signatures)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "signing failed")
            }
        }
    }

    @PluginMethod
    fun broadcastTransaction(call: PluginCall) {
        val transactionHex = call.getString("transactionHex")
            ?: return reject(call, "transactionHex required")
        val network = call.getString("network") ?: "mainnet"
        pluginScope.launch(Dispatchers.IO) {
            try {
                val txid = broadcast(transactionHex, network)
                val ret = JSObject()
                ret.put("txid", txid)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "broadcast failed")
            }
        }
    }

    /** Non-value message signing (domain-separated, used for login/message/BIP-322). */
    @PluginMethod
    fun signTransaction(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: "m/84'/0'/0'/0/0"
        val network = call.getString("network") ?: "mainnet"
        val messageHash = call.getString("messageHash")
            ?: return reject(call, "messageHash required")
        pluginScope.launch {
            try {
                val result = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    val pubkey = Secp256k1Signer.publicKey(privKey)
                    val signature = Secp256k1Signer.signHash(privKey, Hex.decode(messageHash))
                    JSObject().apply {
                        put("signature", Hex.toHexString(signature))
                        put("pubkey", Hex.toHexString(pubkey))
                    }
                }
                call.resolve(result)
            } catch (e: Exception) {
                call.reject(e.message ?: "message signing failed")
            }
        }
    }

    // ── EVM signing (EIP-155 legacy / EIP-1559 / EIP-712 digest) ──────────────────

    /** Derives the EIP-55 checksummed EVM address for the wallet's sovereign key. */
    @PluginMethod
    fun evmAddress(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: EVM_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        pluginScope.launch {
            try {
                val address = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    EvmSigner.addressFromPrivateKey(privKey)
                }
                val ret = JSObject()
                ret.put("address", address)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "EVM address derivation failed")
            }
        }
    }

    /**
     * Signs an unsigned EVM transaction and returns the raw `0x`-prefixed bytes.
     * Numeric fields (wei amounts, nonce, gasLimit, chainId) arrive as strings to
     * avoid JavaScript number-precision loss; hex fields use `0x`-prefixed form.
     */
    @PluginMethod
    fun evmSignTransaction(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: EVM_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        val type = call.getString("type") ?: "eip1559"
        val chainId = call.getString("chainId") ?: return reject(call, "chainId required")
        val nonce = call.getString("nonce") ?: return reject(call, "nonce required")
        val gasLimit = call.getString("gasLimit") ?: return reject(call, "gasLimit required")
        val to = call.getString("to") ?: ""
        val value = call.getString("value") ?: "0x0"
        val data = call.getString("data") ?: "0x"
        pluginScope.launch {
            try {
                val rawHex = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    val toBytes = parseHexBytes(to)
                    val valueWei = parseHexBigInteger(value)
                    val dataBytes = parseHexBytes(data)
                    val raw = if (type == "legacy") {
                        val gasPrice = parseHexBigInteger(call.getString("gasPrice") ?: "0x0")
                        EvmSigner.signLegacyTransaction(
                            privKey, chainId.toLong(), nonce.toLong(), gasPrice,
                            gasLimit.toLong(), toBytes, valueWei, dataBytes,
                        )
                    } else {
                        val maxPriority = parseHexBigInteger(call.getString("maxPriorityFeePerGas") ?: "0x0")
                        val maxFee = parseHexBigInteger(call.getString("maxFeePerGas") ?: "0x0")
                        EvmSigner.signEip1559Transaction(
                            privKey, chainId.toLong(), nonce.toLong(), maxPriority, maxFee,
                            gasLimit.toLong(), toBytes, valueWei, dataBytes,
                        )
                    }
                    Hex.toHexString(raw)
                }
                val ret = JSObject()
                ret.put("rawTransaction", "0x$rawHex")
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "EVM transaction signing failed")
            }
        }
    }

    /** Signs a 32-byte digest (e.g. EIP-712) and returns the 65-byte `r || s || v`. */
    @PluginMethod
    fun evmSignDigest(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: EVM_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        val digest = call.getString("digest") ?: return reject(call, "digest required")
        pluginScope.launch {
            try {
                val signature = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    Hex.toHexString(EvmSigner.signDigest(privKey, Hex.decode(digest)))
                }
                val ret = JSObject()
                ret.put("signature", "0x$signature")
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "EVM digest signing failed")
            }
        }
    }

    // ── Stacks L2 (sBTC) signing ──────────────────────────────────────────────────

    /** Derives the c32check Stacks address (SIP-005) for the sovereign key. */
    @PluginMethod
    fun stacksAddress(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: STACKS_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        pluginScope.launch {
            try {
                val address = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    StacksSigner.addressFromPrivateKey(privKey, testnet = network != "mainnet")
                }
                val ret = JSObject()
                ret.put("address", address)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Stacks address derivation failed")
            }
        }
    }

    /**
     * Signs a 32-byte SHA512/256 digest (SIP-018) computed by the TS layer and
     * returns a 65-byte `r || s || recoveryId` (hex). The TS layer assembles the
     * final Stacks signature from these components.
     */
    @PluginMethod
    fun stacksSignDigest(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: STACKS_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        val digest = call.getString("digest") ?: return reject(call, "digest required")
        pluginScope.launch {
            try {
                val signature = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    Hex.toHexString(StacksSigner.signDigest(privKey, Hex.decode(digest)))
                }
                val ret = JSObject()
                ret.put("signature", signature)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Stacks digest signing failed")
            }
        }
    }

    // ── Liquid Network signing ────────────────────────────────────────────────────

    /** Derives the unconfidential Liquid P2WPKH (bech32) address. */
    @PluginMethod
    fun liquidAddress(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: LIQUID_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        pluginScope.launch {
            try {
                val address = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    LiquidSigner.addressFromPrivateKey(privKey, network)
                }
                val ret = JSObject()
                ret.put("address", address)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Liquid address derivation failed")
            }
        }
    }

    /** Signs a 32-byte Elements sighash, returning `DER(r, s) || 0x01` (hex). */
    @PluginMethod
    fun liquidSignDigest(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: LIQUID_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        val digest = call.getString("digest") ?: return reject(call, "digest required")
        pluginScope.launch {
            try {
                val signature = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    Hex.toHexString(LiquidSigner.signDigest(privKey, Hex.decode(digest)))
                }
                val ret = JSObject()
                ret.put("signature", signature)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Liquid sighash signing failed")
            }
        }
    }

    // ── Taproot / Babylon signing (BIP-340 Schnorr + BIP-86 P2TR) ─────────────────

    /** Derives the BIP-86 single-key P2TR taproot address for the wallet's key. */
    @PluginMethod
    fun taprootAddress(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: TAPROOT_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        pluginScope.launch {
            try {
                val address = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    TaprootSigner.p2trAddress(
                        TaprootSigner.taprootOutputKey(TaprootSigner.xOnlyPublicKey(privKey)),
                        network,
                    )
                }
                val ret = JSObject()
                ret.put("address", address)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Taproot address derivation failed")
            }
        }
    }

    /** Signs a 32-byte taproot keypath digest (BIP-340 Schnorr), returns 64-byte hex. */
    @PluginMethod
    fun schnorrSignDigest(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: TAPROOT_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        val digest = call.getString("digest") ?: return reject(call, "digest required")
        pluginScope.launch {
            try {
                val signature = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    val auxRand = ByteArray(32)
                    SecureRandom().nextBytes(auxRand)
                    Hex.toHexString(TaprootSigner.schnorrSign(privKey, Hex.decode(digest), auxRand))
                }
                val ret = JSObject()
                ret.put("signature", signature)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Schnorr digest signing failed")
            }
        }
    }

    // ── MuSig2 (BIP-327) n-of-n Schnorr multisig ────────────────────────────────

    /** BIP-327 KeyAgg: 32-byte x-only aggregate public key from 33-byte compressed keys. */
    @PluginMethod
    fun musig2AggregatePubkeys(call: PluginCall) {
        val pubkeys = hexList(call, "pubkeys") ?: return reject(call, "pubkeys required")
        if (pubkeys.isEmpty()) return reject(call, "pubkeys required")
        val aggregate = Musig2Signer.keyAggregate(pubkeys.map { Hex.decode(it) })
        val ret = JSObject()
        ret.put("aggregatePubkey", Hex.toHexString(aggregate))
        call.resolve(ret)
    }

    /** BIP-327 KeySort: canonical lexicographic order of 33-byte compressed keys. */
    @PluginMethod
    fun musig2SortPubkeys(call: PluginCall) {
        val pubkeys = hexList(call, "pubkeys") ?: return reject(call, "pubkeys required")
        val sorted = Musig2Signer.keySort(pubkeys.map { Hex.decode(it) })
        val arr = JSArray()
        sorted.forEach { arr.put(Hex.toHexString(it)) }
        val ret = JSObject()
        ret.put("sortedPubkeys", arr)
        call.resolve(ret)
    }

    /**
     * BIP-327 NonceGen for the wallet key. `aggpk` (x-only), `message` and `extraIn`
     * are optional hex strings; fresh `rand'` is drawn internally with [SecureRandom].
     * Returns (secnonce 97 bytes, pubnonce 66 bytes) as hex.
     */
    @PluginMethod
    fun musig2GenerateNonce(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: TAPROOT_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        val aggpk = call.getString("aggpk")?.let { Hex.decode(it) }
        val message = call.getString("message")?.let { Hex.decode(it) }
        val extra = call.getString("extra")?.let { Hex.decode(it) }
        pluginScope.launch {
            try {
                val (secnonce, pubnonce) = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    val sk = Musig2Signer.secretScalar(privKey)
                    val pk = Secp256k1Signer.publicKey(privKey)
                    val random = ByteArray(32)
                    SecureRandom().nextBytes(random)
                    Musig2Signer.nonceGen(sk, pk, aggpk, message, extra, random)
                }
                val ret = JSObject()
                ret.put("secnonce", Hex.toHexString(secnonce))
                ret.put("pubnonce", Hex.toHexString(pubnonce))
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "MuSig2 nonce generation failed")
            }
        }
    }

    /** BIP-327 NonceAgg: 66-byte aggregate nonce from 66-byte pubnonces. */
    @PluginMethod
    fun musig2AggregateNonces(call: PluginCall) {
        val pubnonces = hexList(call, "pubnonces") ?: return reject(call, "pubnonces required")
        if (pubnonces.isEmpty()) return reject(call, "pubnonces required")
        val aggregate = Musig2Signer.nonceAggregate(pubnonces.map { Hex.decode(it) })
        val ret = JSObject()
        ret.put("aggregateNonce", Hex.toHexString(aggregate))
        call.resolve(ret)
    }

    /** BIP-327 Sign: 32-byte partial signature for the wallet key. */
    @PluginMethod
    fun musig2SignPartial(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: TAPROOT_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        val secnonce = Hex.decode(call.getString("secnonce") ?: return reject(call, "secnonce required"))
        val aggnonce = Hex.decode(call.getString("aggnonce") ?: return reject(call, "aggnonce required"))
        val pubkeys = hexList(call, "pubkeys")?.map { Hex.decode(it) } ?: return reject(call, "pubkeys required")
        val tweaks = hexList(call, "tweaks")?.map { Hex.decode(it) } ?: emptyList()
        val isXonly = boolList(call, "isXonly") ?: emptyList()
        val message = Hex.decode(call.getString("message") ?: return reject(call, "message required"))
        pluginScope.launch {
            try {
                val partial = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    val sk = Musig2Signer.secretScalar(privKey)
                    Musig2Signer.signPartial(secnonce, sk, aggnonce, pubkeys, tweaks, isXonly, message)
                }
                val ret = JSObject()
                ret.put("partialSignature", Hex.toHexString(partial))
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "MuSig2 partial signing failed")
            }
        }
    }

    /** BIP-327 PartialSigVerify: blame-free boolean check of a partial signature. */
    @PluginMethod
    fun musig2VerifyPartial(call: PluginCall) {
        val psig = Hex.decode(call.getString("partialSignature") ?: return reject(call, "partialSignature required"))
        val pubnonce = Hex.decode(call.getString("pubnonce") ?: return reject(call, "pubnonce required"))
        val pubnonces = hexList(call, "pubnonces")?.map { Hex.decode(it) } ?: return reject(call, "pubnonces required")
        val pubkeys = hexList(call, "pubkeys")?.map { Hex.decode(it) } ?: return reject(call, "pubkeys required")
        val tweaks = hexList(call, "tweaks")?.map { Hex.decode(it) } ?: emptyList()
        val isXonly = boolList(call, "isXonly") ?: emptyList()
        val message = Hex.decode(call.getString("message") ?: return reject(call, "message required"))
        val signerIndex = call.getInt("signerIndex") ?: return reject(call, "signerIndex required")
        val valid = Musig2Signer.partialSigVerify(
            psig, pubnonce, pubnonces, pubkeys, tweaks, isXonly, message, signerIndex,
        )
        val ret = JSObject()
        ret.put("valid", valid)
        call.resolve(ret)
    }

    /** BIP-327 PartialSigAgg: 64-byte BIP-340 signature from partial signatures. */
    @PluginMethod
    fun musig2AggregateSignatures(call: PluginCall) {
        val partialSigs = hexList(call, "partialSignatures")?.map { Hex.decode(it) }
            ?: return reject(call, "partialSignatures required")
        val aggnonce = Hex.decode(call.getString("aggnonce") ?: return reject(call, "aggnonce required"))
        val pubkeys = hexList(call, "pubkeys")?.map { Hex.decode(it) } ?: return reject(call, "pubkeys required")
        val tweaks = hexList(call, "tweaks")?.map { Hex.decode(it) } ?: emptyList()
        val isXonly = boolList(call, "isXonly") ?: emptyList()
        val message = Hex.decode(call.getString("message") ?: return reject(call, "message required"))
        val signature = Musig2Signer.partialSigAggregate(partialSigs, aggnonce, pubkeys, tweaks, isXonly, message)
        val ret = JSObject()
        ret.put("signature", Hex.toHexString(signature))
        call.resolve(ret)
    }

    // ── Nostr (NIP-01 / NIP-06 / NIP-47) non-custodial event signing ────────

    /** 32-byte x-only Nostr identity pubkey (hex) at the NIP-06 path. */
    @PluginMethod
    fun nostrGetPubkey(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: NOSTR_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        pluginScope.launch {
            try {
                val pubkey = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    NostrSigner.publicKeyHex(privKey)
                }
                val ret = JSObject()
                ret.put("pubkey", pubkey)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Nostr pubkey derivation failed")
            }
        }
    }

    /** NIP-01 event id + BIP-340 Schnorr signature over the canonical serialization. */
    @PluginMethod
    fun nostrSignEvent(call: PluginCall) {
        val application = app ?: return reject(call, "application unavailable")
        val path = call.getString("path") ?: NOSTR_DEFAULT_PATH
        val network = call.getString("network") ?: "mainnet"
        val serialized = call.getString("serialized") ?: return reject(call, "serialized required")
        pluginScope.launch {
            try {
                val id = NostrSigner.eventId(serialized)
                val signature = application.walletSeedProvider.withSeed { material ->
                    val mnemonic = String(material.mnemonicBytes, Charsets.UTF_8)
                    val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
                    val auxRand = ByteArray(32)
                    SecureRandom().nextBytes(auxRand)
                    NostrSigner.signEventId(privKey, id, auxRand)
                }
                val ret = JSObject()
                ret.put("id", Hex.toHexString(id))
                ret.put("signature", Hex.toHexString(signature))
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message ?: "Nostr event signing failed")
            }
        }
    }

    /** BIP-340 verification of a Nostr event signature. */
    @PluginMethod
    fun nostrVerifyEvent(call: PluginCall) {
        val pubkey = Hex.decode(call.getString("pubkey") ?: return reject(call, "pubkey required"))
        val id = Hex.decode(call.getString("id") ?: return reject(call, "id required"))
        val signature = Hex.decode(call.getString("signature") ?: return reject(call, "signature required"))
        val valid = NostrSigner.verifyEventSignature(pubkey, id, signature)
        val ret = JSObject()
        ret.put("valid", valid)
        call.resolve(ret)
    }

    // ── Secondary vault-state storage (seed itself lives in Room/StrongBox) ─────────

    @PluginMethod
    fun getItem(call: PluginCall) {
        val key = call.getString("key") ?: return reject(call, "key required")
        val value = preferences().getString(key, null)
        val ret = JSObject()
        ret.put("value", value)
        call.resolve(ret)
    }

    @PluginMethod
    fun hasItem(call: PluginCall) {
        val key = call.getString("key") ?: return reject(call, "key required")
        val ret = JSObject()
        ret.put("exists", preferences().contains(key))
        call.resolve(ret)
    }

    @PluginMethod
    fun setItem(call: PluginCall) {
        val key = call.getString("key") ?: return reject(call, "key required")
        val value = call.getString("value") ?: return reject(call, "value required")
        preferences().edit().putString(key, value).apply()
        call.resolve()
    }

    @PluginMethod
    fun removeItem(call: PluginCall) {
        val key = call.getString("key") ?: return reject(call, "key required")
        preferences().edit().remove(key).apply()
        call.resolve()
    }

    @PluginMethod
    fun authenticate(call: PluginCall) {
        val ret = JSObject()
        ret.put("authenticated", false)
        call.resolve(ret)
    }

    @PluginMethod
    fun clearBiometricSession(call: PluginCall) {
        call.resolve()
    }

    @PluginMethod
    fun unlockSession(call: PluginCall) {
        val ret = JSObject()
        ret.put("unlocked", app?.walletSession?.isUnlocked?.value ?: false)
        call.resolve(ret)
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────────

    private fun derivePublicKeyHex(mnemonic: String, path: String, network: String): String {
        val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
        return Hex.toHexString(Secp256k1Signer.publicKey(privKey))
    }

    private fun parseHexBigInteger(value: String): BigInteger {
        val cleaned = value.removePrefix("0x")
        return if (cleaned.isEmpty()) BigInteger.ZERO else BigInteger(cleaned, 16)
    }

    private fun parseHexBytes(value: String): ByteArray {
        val cleaned = value.removePrefix("0x")
        return if (cleaned.isEmpty()) byteArrayOf() else Hex.decode(cleaned)
    }

    private fun hexList(call: PluginCall, key: String): List<String>? {
        val arr = call.getArray(key) ?: return null
        return (0 until arr.length()).map { arr.getString(it) ?: "" }
    }

    private fun boolList(call: PluginCall, key: String): List<Boolean>? {
        val arr = call.getArray(key) ?: return null
        return (0 until arr.length()).map { arr.getBoolean(it) }
    }

    private fun signHashes(mnemonic: String, path: String, network: String, hashHexList: List<String>): JSArray {
        val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, network)
        val pubkey = Secp256k1Signer.publicKey(privKey)
        val array = JSArray()
        for (hashHex in hashHexList) {
            val signature = Secp256k1Signer.signHash(privKey, Hex.decode(hashHex))
            array.put(JSObject().apply {
                put("signature", Hex.toHexString(signature))
                put("pubkey", Hex.toHexString(pubkey))
            })
        }
        return array
    }

    private fun broadcast(transactionHex: String, network: String): String {
        val endpoint = if (network == "mainnet") {
            "https://blockstream.info/api/tx"
        } else {
            "https://blockstream.info/testnet/api/tx"
        }
        val connection = URL(endpoint).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "text/plain")
        connection.outputStream.use { it.write(transactionHex.toByteArray(Charsets.UTF_8)) }
        val code = connection.responseCode
        val body = connection.inputStream.bufferedReader().use { it.readText() }
        if (code !in 200..299) {
            throw IllegalStateException("broadcast rejected ($code): $body")
        }
        return body.trim()
    }

    private fun preferences() =
        requireNotNull(activity).applicationContext.getSharedPreferences("conxius_secure_enclave", 0)
}

