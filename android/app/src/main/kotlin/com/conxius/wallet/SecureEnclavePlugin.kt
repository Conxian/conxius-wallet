package com.conxius.wallet

import com.conxius.wallet.bitcoin.EvmSigner
import com.conxius.wallet.bitcoin.Secp256k1Signer
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

