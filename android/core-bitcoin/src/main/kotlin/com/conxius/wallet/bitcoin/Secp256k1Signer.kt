package com.conxius.wallet.bitcoin

import org.bitcoindevkit.DerivationPath
import org.bitcoindevkit.DescriptorSecretKey
import org.bitcoindevkit.Mnemonic
import org.bitcoindevkit.NetworkKind
import org.bouncycastle.asn1.sec.SECNamedCurves
import org.bouncycastle.asn1.x9.X9ECParameters
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.params.ECDomainParameters
import org.bouncycastle.crypto.params.ECPrivateKeyParameters
import org.bouncycastle.crypto.signers.ECDSASigner
import org.bouncycastle.crypto.signers.HMacDSAKCalculator
import java.math.BigInteger

/**
 * Non-custodial value-signing primitives.
 *
 * BIP39/BIP32 derivation is delegated to BDK (battle-tested); the raw sighash ECDSA
 * signing and compressed-key derivation use Bouncy Castle. Stateless: never touches
 * storage, never logs secrets. The mnemonic is borrowed via [WalletSeedProvider.withSeed]
 * and wiped by that provider.
 */
object Secp256k1Signer {
    private val CURVE: X9ECParameters = SECNamedCurves.getByName("secp256k1")
    private val DOMAIN = ECDomainParameters(CURVE.curve, CURVE.g, CURVE.n, CURVE.h)
    private val HALF_N: BigInteger = DOMAIN.n.shiftRight(1)

    /** Derive the private scalar at a BIP path such as "m/84'/0'/0'/0/0" from a BIP39 mnemonic. */
    fun derivePrivateKey(mnemonic: String, path: String, network: String = "mainnet"): BigInteger {
        val kind = if (network == "mainnet") NetworkKind.MAIN else NetworkKind.TEST
        val root = DescriptorSecretKey(kind, Mnemonic.fromString(mnemonic), null)
        val child = root.derive(DerivationPath(path))
        return BigInteger(1, child.secretBytes())
    }

    /** Compressed (33-byte) secp256k1 public key for a private scalar. */
    fun publicKey(privateKey: BigInteger): ByteArray =
        CURVE.g.multiply(privateKey).normalize().getEncoded(true)

    /**
     * ECDSA sign a 32-byte hash, returning the full Bitcoin signature
     * `DER(r, s) || sighashType` with low-S normalization.
     */
    fun signHash(privateKey: BigInteger, hash: ByteArray, sighashType: Int = SIGHASH_ALL): ByteArray {
        val signer = ECDSASigner(HMacDSAKCalculator(SHA256Digest()))
        signer.init(true, ECPrivateKeyParameters(privateKey, DOMAIN))
        val components = signer.generateSignature(hash)
        var r = components[0]
        var s = components[1]
        if (s.compareTo(HALF_N) > 0) {
            s = DOMAIN.n.subtract(s)
        }
        return derEncode(r, s) + byteArrayOf(sighashType.toByte())
    }

    private fun derEncode(r: BigInteger, s: BigInteger): ByteArray {
        val rBytes = minimalBytes(r)
        val sBytes = minimalBytes(s)
        val totalLength = 2 + rBytes.size + 2 + sBytes.size
        val out = ByteArray(2 + totalLength)
        out[0] = 0x30.toByte()
        out[1] = totalLength.toByte()
        out[2] = 0x02.toByte()
        out[3] = rBytes.size.toByte()
        System.arraycopy(rBytes, 0, out, 4, rBytes.size)
        val offset = 4 + rBytes.size
        out[offset] = 0x02.toByte()
        out[offset + 1] = sBytes.size.toByte()
        System.arraycopy(sBytes, 0, out, offset + 2, sBytes.size)
        return out
    }

    private fun minimalBytes(value: BigInteger): ByteArray {
        var bytes = value.toByteArray()
        if (bytes.size > 1 && bytes[0] == 0.toByte()) {
            bytes = bytes.copyOfRange(1, bytes.size)
        }
        if (bytes[0].toInt() and 0x80 != 0) {
            bytes = byteArrayOf(0x00) + bytes
        }
        return bytes
    }

    const val SIGHASH_ALL: Int = 0x01
}
