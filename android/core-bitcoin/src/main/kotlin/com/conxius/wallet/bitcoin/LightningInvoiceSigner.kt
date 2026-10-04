package com.conxius.wallet.bitcoin

import org.bouncycastle.crypto.digests.SHA256Digest
import java.math.BigInteger

/**
 * BOLT-11 invoice signing primitives.
 *
 * A Lightning invoice is a Bech32 string (BIP-173, no length limit) whose data
 * part is `timestamp || tagged-fields || signature`. The signature is a compact
 * ECDSA/secp256k1 signature (65 bytes: `r || s || recovery-id`) over
 * `SHA256(hrp || data-before-signature)`, where the trailing data is 5-bit
 * packed to a byte boundary with zero padding (BOLT-11 §Requirements).
 *
 * Reuses [EvmSigner]'s RFC-6979 low-S ECDSA with public-key recovery — the
 * exact same primitive BOLT-11 requires. The canonical message-hash vector from
 * BOLT-11 is asserted in [LightningInvoiceSignerTest].
 *
 * Stateless and secret-safe: private scalars are passed in by the caller.
 */
object LightningInvoiceSigner {
    private const val CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

    /** Number of 5-bit words in a BOLT-11 signature (520 bits). */
    private const val SIGNATURE_WORDS = 104

    /** Number of 5-bit words in a Bech32 checksum. */
    private const val CHECKSUM_WORDS = 6

    /** The 32-byte message a BOLT-11 signature signs (SHA256 of hrp + data). */
    fun invoiceMessageHash(invoice: String): ByteArray {
        val (hrp, data5) = bech32Decode(invoice)
        val dataWithoutSignature = data5.dropLast(SIGNATURE_WORDS + CHECKSUM_WORDS)
        val dataBytes = convertBits(dataWithoutSignature.toIntArray(), 5, 8, true)
        val preimage = hrp.toByteArray(Charsets.UTF_8) + dataBytes
        return sha256(preimage)
    }

    /** 65-byte compact ECDSA signature `r || s || recovery-id` over a 32-byte [message]. */
    fun signDigest(privateKey: BigInteger, message: ByteArray): ByteArray {
        val sig = EvmSigner.sign(privateKey, message)
        return sig.r + sig.s + byteArrayOf(sig.recoveryId.toByte())
    }

    /** Recovers the 65-byte uncompressed public key that produced a BOLT-11 signature. */
    fun recoverPublicKey(message: ByteArray, signature65: ByteArray): ByteArray {
        require(signature65.size == 65) { "BOLT-11 signature must be 65 bytes" }
        val sig = EvmSigner.Signature(
            signature65.copyOfRange(0, 32),
            signature65.copyOfRange(32, 64),
            signature65[64].toInt() and 0xff,
        )
        return EvmSigner.recoverPublicKey(message, sig)
    }

    // ── Bech32 helpers ───────────────────────────────────────────────────────

    private fun bech32Decode(invoice: String): Pair<String, IntArray> {
        val lower = invoice.lowercase()
        val sep = lower.lastIndexOf('1')
        require(sep >= 1) { "invalid bech32: no separator" }
        val hrp = lower.substring(0, sep)
        val dataPart = lower.substring(sep + 1)
        val data = IntArray(dataPart.length)
        for (i in dataPart.indices) {
            val idx = CHARSET.indexOf(dataPart[i])
            require(idx >= 0) { "invalid bech32 character" }
            data[i] = idx
        }
        return Pair(hrp, data)
    }

    private fun convertBits(data: IntArray, fromBits: Int, toBits: Int, pad: Boolean): ByteArray {
        var acc = 0
        var bits = 0
        val maxv = (1 shl toBits) - 1
        val ret = mutableListOf<Int>()
        for (value in data) {
            acc = (acc shl fromBits) or (value and 0xff)
            bits += fromBits
            while (bits >= toBits) {
                bits -= toBits
                ret.add((acc ushr bits) and maxv)
            }
        }
        if (pad && bits > 0) ret.add((acc shl (toBits - bits)) and maxv)
        return ByteArray(ret.size) { ret[it].toByte() }
    }

    private fun sha256(data: ByteArray): ByteArray {
        val d = SHA256Digest()
        d.update(data, 0, data.size)
        val out = ByteArray(d.digestSize)
        d.doFinal(out, 0)
        return out
    }
}
