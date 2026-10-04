package com.conxius.wallet.bitcoin

import org.bouncycastle.crypto.digests.RIPEMD160Digest
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.digests.SHA512tDigest
import org.bouncycastle.util.encoders.Hex
import java.math.BigInteger

/**
 * Stacks (sBTC) native signing primitives.
 *
 * Stacks reuses secp256k1 but derives addresses from the *uncompressed* public
 * key (hash160), encodes them with c32check (SIP-005), and signs SHA512/256
 * (SIP-018) digests, returning a 65-byte `r || s || recoveryId` signature.
 *
 * Conformance vectors (see StacksSignerTest) were generated against
 * @stacks/transactions v7.6.0.
 */
object StacksSigner {
    private const val C32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    private const val HEX_ALPHABET = "0123456789abcdef"

    private const val VERSION_MAINNET_SINGLE_SIG = 22
    private const val VERSION_TESTNET_SINGLE_SIG = 26

    /** SHA512/256 (the Stacks transaction / structured-data digest). */
    fun sha512256(data: ByteArray): ByteArray {
        val digest = SHA512tDigest(256)
        digest.update(data, 0, data.size)
        val out = ByteArray(digest.digestSize)
        digest.doFinal(out, 0)
        return out
    }

    /** RIPEMD160(SHA256(data)) — used for the Stacks P2PKH address. */
    fun hash160(data: ByteArray): ByteArray {
        val sha = SHA256Digest()
        sha.update(data, 0, data.size)
        val shaOut = ByteArray(sha.digestSize)
        sha.doFinal(shaOut, 0)

        val ripemd = RIPEMD160Digest()
        ripemd.update(shaOut, 0, shaOut.size)
        val out = ByteArray(ripemd.digestSize)
        ripemd.doFinal(out, 0)
        return out
    }

    /** Signs a 32-byte digest and returns a 65-byte `r || s || recoveryId`. */
    fun signDigest(privateKey: BigInteger, digest: ByteArray): ByteArray {
        require(digest.size == 32) { "Stacks signing expects a 32-byte digest" }
        val sig = EvmSigner.sign(privateKey, digest)
        return sig.r + sig.s + byteArrayOf(sig.recoveryId.toByte())
    }

    /**
     * Derives the c32check-encoded Stacks address (SIP-005) from the wallet's
     * sovereign private key. Mainnet addresses start with `SP`, testnet with `ST`.
     */
    fun addressFromPrivateKey(privateKey: BigInteger, testnet: Boolean = false): String {
        val uncompressed = EvmSigner.uncompressedPublicKey(privateKey)
        val version = if (testnet) VERSION_TESTNET_SINGLE_SIG else VERSION_MAINNET_SINGLE_SIG
        return "S" + c32checkEncode(version, Hex.toHexString(hash160(uncompressed)))
    }

    // ── c32check (SIP-005) ─────────────────────────────────────────────────────

    private fun c32checkEncode(version: Int, dataHex: String): String {
        require(version in 0..31) { "Invalid c32 version (must be 0..31)" }
        var data = dataHex.lowercase()
        if (data.length % 2 != 0) data = "0$data"

        val versionHex = Integer.toHexString(version).padStart(2, '0')
        val checksumHex = sha256dHex(versionHex + data).substring(0, 8)
        return C32_ALPHABET[version] + c32encode(data + checksumHex)
    }

    private fun sha256dHex(hex: String): String {
        val first = SHA256Digest()
        val bytes = Hex.decode(hex)
        first.update(bytes, 0, bytes.size)
        val firstOut = ByteArray(first.digestSize)
        first.doFinal(firstOut, 0)

        val second = SHA256Digest()
        second.update(firstOut, 0, firstOut.size)
        val secondOut = ByteArray(second.digestSize)
        second.doFinal(secondOut, 0)
        return Hex.toHexString(secondOut)
    }

    private fun c32encode(inputHex: String): String {
        var input = inputHex.lowercase()
        if (input.length % 2 != 0) input = "0$input"

        val res = mutableListOf<Char>()
        var carry = 0
        for (i in input.length - 1 downTo 0) {
            if (carry < 4) {
                val currentCode = HEX_ALPHABET.indexOf(input[i]) shr carry
                var nextCode = 0
                if (i != 0) nextCode = HEX_ALPHABET.indexOf(input[i - 1])
                val nextBits = 1 + carry
                val nextLowBits = (nextCode % (1 shl nextBits)) shl (5 - nextBits)
                res.add(0, C32_ALPHABET[currentCode + nextLowBits])
                carry = nextBits
            } else {
                carry = 0
            }
        }

        // Strip leading zero digits.
        while (res.isNotEmpty() && res.first() == '0') res.removeAt(0)

        // Preserve leading zero bytes from the original hex input.
        var leadingZeroBytes = 0
        var j = 0
        while (j + 1 < input.length && input[j] == '0' && input[j + 1] == '0') {
            leadingZeroBytes++
            j += 2
        }
        repeat(leadingZeroBytes) { res.add(0, '0') }

        return res.joinToString("")
    }
}
