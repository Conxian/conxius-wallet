package com.conxius.wallet.bitcoin

import org.bouncycastle.asn1.sec.SECNamedCurves
import org.bouncycastle.asn1.x9.X9ECParameters
import org.bouncycastle.crypto.digests.KeccakDigest
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.params.ECDomainParameters
import org.bouncycastle.crypto.params.ECPrivateKeyParameters
import org.bouncycastle.crypto.signers.ECDSASigner
import org.bouncycastle.crypto.signers.HMacDSAKCalculator
import org.bouncycastle.math.ec.ECPoint
import org.bouncycastle.util.encoders.Hex
import java.math.BigInteger

/**
 * Non-custodial EVM value-signing primitives.
 *
 * Signs EIP-155 (legacy) and EIP-1559 (dynamic fee) transactions plus raw 32-byte
 * digests (for EIP-712 typed data) using the same secp256k1 root as Bitcoin L1:
 * Bouncy Castle RFC-6979 ECDSA with low-S normalization and public-key recovery,
 * and Keccak-256 for the EVM hashes. Stateless — never touches storage and never
 * logs secrets. The private scalar is derived upstream via [Secp256k1Signer] and
 * borrowed only for the duration of a call.
 */
object EvmSigner {
    private val CURVE: X9ECParameters = SECNamedCurves.getByName("secp256k1")
    private val DOMAIN = ECDomainParameters(CURVE.curve, CURVE.g, CURVE.n, CURVE.h)
    private val N: BigInteger = DOMAIN.n
    private val HALF_N: BigInteger = N.shiftRight(1)

    /** A raw secp256k1 ECDSA signature over a 32-byte digest, with the recovery id. */
    data class Signature(val r: ByteArray, val s: ByteArray, val recoveryId: Int) {
        init {
            require(r.size == 32 && s.size == 32) { "r and s must be 32 bytes" }
            require(recoveryId in 0..3) { "recoveryId must be in 0..3" }
        }
    }

    data class AccessListItem(val address: ByteArray, val storageKeys: List<ByteArray>)

    // ── Hashing ─────────────────────────────────────────────────────────────────

    /** Ethereum Keccak-256 (pre-NIST padding), matching keccak256 in the TS layer. */
    fun keccak256(data: ByteArray): ByteArray {
        val digest = KeccakDigest(256)
        digest.update(data, 0, data.size)
        val out = ByteArray(32)
        digest.doFinal(out, 0)
        return out
    }

    // ── Address derivation ──────────────────────────────────────────────────────

    /** 65-byte uncompressed public key (0x04 || x || y) for a private scalar. */
    fun uncompressedPublicKey(privateKey: BigInteger): ByteArray {
        val point = CURVE.g.multiply(privateKey).normalize()
        return byteArrayOf(0x04) +
            toFixed32(point.affineXCoord.toBigInteger()) +
            toFixed32(point.affineYCoord.toBigInteger())
    }

    /** EIP-55 checksummed EVM address (0x...) for a private scalar. */
    fun addressFromPrivateKey(privateKey: BigInteger): String =
        addressFromPublicKey(uncompressedPublicKey(privateKey))

    /** EIP-55 checksummed EVM address from a 65-byte (or 64-byte) public key. */
    fun addressFromPublicKey(publicKey: ByteArray): String {
        val payload = if (publicKey.size == 65 && publicKey[0] == 0x04.toByte()) {
            publicKey.copyOfRange(1, 65)
        } else {
            require(publicKey.size == 64) { "public key must be 64 or 65 bytes" }
            publicKey
        }
        return toChecksumAddress(keccak256(payload).copyOfRange(12, 32))
    }

    fun toChecksumAddress(address20: ByteArray): String {
        require(address20.size == 20) { "EVM address must be 20 bytes" }
        val hex = Hex.toHexString(address20)
        val hash = Hex.toHexString(keccak256(hex.toByteArray(Charsets.US_ASCII)))
        val out = StringBuilder("0x")
        for (i in hex.indices) {
            val c = hex[i]
            val h = Character.digit(hash[i], 16)
            out.append(if (h >= 8) c.uppercaseChar() else c)
        }
        return out.toString()
    }

    // ── Signing ─────────────────────────────────────────────────────────────────

    /**
     * RFC-6979 ECDSA over a 32-byte digest, returning fixed 32-byte r/s and the
     * recovery id. Normalizes to low-S (required by EIP-2 for legacy transactions).
     */
    fun sign(privateKey: BigInteger, digest: ByteArray): Signature {
        require(digest.size == 32) { "EVM digest must be 32 bytes" }
        val signer = ECDSASigner(HMacDSAKCalculator(SHA256Digest()))
        signer.init(true, ECPrivateKeyParameters(privateKey, DOMAIN))
        val components = signer.generateSignature(digest)
        val r = components[0]
        var s = components[1]
        if (s > HALF_N) s = N.subtract(s)

        // Recover R = (z/s)G + (r/s)Q; the recovery id encodes whether R.x == r
        // (0/1) or r + n (2/3) and the parity of R.y.
        val z = BigInteger(1, digest)
        val sInv = s.modInverse(N)
        val u1 = z.multiply(sInv).mod(N)
        val u2 = r.multiply(sInv).mod(N)
        val q = CURVE.g.multiply(privateKey).normalize()
        val pointR = CURVE.g.multiply(u1).add(q.multiply(u2)).normalize()
        val recoveryId = (if (pointR.affineXCoord.toBigInteger() == r) 0 else 2) +
            (if (pointR.affineYCoord.toBigInteger().testBit(0)) 1 else 0)

        return Signature(toFixed32(r), toFixed32(s), recoveryId)
    }

    /** Signs a 32-byte digest and returns the 65-byte `r || s || v` EVM signature. */
    fun signDigest(privateKey: BigInteger, digest: ByteArray): ByteArray {
        val sig = sign(privateKey, digest)
        return sig.r + sig.s + byteArrayOf((sig.recoveryId + 27).toByte())
    }

    /** Recovers the 65-byte uncompressed public key (0x04 || x || y) behind [signature] over [digest]. */
    fun recoverPublicKey(digest: ByteArray, signature: Signature): ByteArray {
        val r = BigInteger(1, signature.r)
        val s = BigInteger(1, signature.s)
        val z = BigInteger(1, digest)
        val x = if (signature.recoveryId >= 2) r.add(N) else r
        val oddY = (signature.recoveryId and 1) == 1
        val pointR = decompressPoint(x, oddY)
        val rInv = r.modInverse(N)
        val q = pointR.multiply(s).subtract(CURVE.g.multiply(z)).multiply(rInv).normalize()
        return byteArrayOf(0x04) +
            toFixed32(q.affineXCoord.toBigInteger()) +
            toFixed32(q.affineYCoord.toBigInteger())
    }

    /** Recovers the EIP-55 address that produced [signature] over [digest]. */
    fun recoverAddress(digest: ByteArray, signature: Signature): String =
        addressFromPublicKey(recoverPublicKey(digest, signature))

    // ── Transaction signing ─────────────────────────────────────────────────────

    fun signLegacyTransaction(
        privateKey: BigInteger,
        chainId: Long,
        nonce: Long,
        gasPrice: BigInteger,
        gasLimit: Long,
        to: ByteArray,
        value: BigInteger,
        data: ByteArray,
    ): ByteArray {
        val digest = keccak256(
            rlpList(
                rlpLong(nonce),
                rlpLong(gasPrice),
                rlpLong(gasLimit),
                rlpBytes(to),
                rlpLong(value),
                rlpBytes(data),
                rlpLong(chainId),
                rlpLong(0L),
                rlpLong(0L),
            ),
        )
        val sig = sign(privateKey, digest)
        val v = BigInteger.valueOf(chainId).multiply(BigInteger.TWO)
            .add(BigInteger.valueOf(35L + sig.recoveryId))
        return rlpList(
            rlpLong(nonce),
            rlpLong(gasPrice),
            rlpLong(gasLimit),
            rlpBytes(to),
            rlpLong(value),
            rlpBytes(data),
            rlpLong(v),
            rlpBytes(sig.r),
            rlpBytes(sig.s),
        )
    }

    fun signEip1559Transaction(
        privateKey: BigInteger,
        chainId: Long,
        nonce: Long,
        maxPriorityFeePerGas: BigInteger,
        maxFeePerGas: BigInteger,
        gasLimit: Long,
        to: ByteArray,
        value: BigInteger,
        data: ByteArray,
        accessList: List<AccessListItem> = emptyList(),
    ): ByteArray {
        val digest = keccak256(
            byteArrayOf(0x02) + rlpList(
                rlpLong(chainId),
                rlpLong(nonce),
                rlpLong(maxPriorityFeePerGas),
                rlpLong(maxFeePerGas),
                rlpLong(gasLimit),
                rlpBytes(to),
                rlpLong(value),
                rlpBytes(data),
                rlpAccessList(accessList),
            ),
        )
        val sig = sign(privateKey, digest)
        return byteArrayOf(0x02) + rlpList(
            rlpLong(chainId),
            rlpLong(nonce),
            rlpLong(maxPriorityFeePerGas),
            rlpLong(maxFeePerGas),
            rlpLong(gasLimit),
            rlpBytes(to),
            rlpLong(value),
            rlpBytes(data),
            rlpAccessList(accessList),
            rlpLong(sig.recoveryId.toLong()),
            rlpBytes(sig.r),
            rlpBytes(sig.s),
        )
    }

    // ── RLP encoding ────────────────────────────────────────────────────────────

    private fun rlpBytes(bytes: ByteArray): ByteArray {
        if (bytes.isEmpty()) return byteArrayOf(0x80.toByte())
        if (bytes.size == 1 && (bytes[0].toInt() and 0xff) < 0x80) return bytes
        val prefix = if (bytes.size < 0x38) {
            byteArrayOf((0x80 + bytes.size).toByte())
        } else {
            val len = bigEndianLength(bytes.size)
            byteArrayOf((0xb7 + len.size).toByte()) + len
        }
        return prefix + bytes
    }

    private fun rlpList(vararg items: ByteArray): ByteArray {
        var payload = byteArrayOf()
        for (item in items) payload += item
        val prefix = if (payload.size < 0x38) {
            byteArrayOf((0xc0 + payload.size).toByte())
        } else {
            val len = bigEndianLength(payload.size)
            byteArrayOf((0xf7 + len.size).toByte()) + len
        }
        return prefix + payload
    }

    private fun rlpLong(value: Long): ByteArray = rlpBytes(minimalBigEndian(BigInteger.valueOf(value)))

    private fun rlpLong(value: BigInteger): ByteArray = rlpBytes(minimalBigEndian(value))

    private fun rlpAccessList(items: List<AccessListItem>): ByteArray {
        if (items.isEmpty()) return byteArrayOf(0xc0.toByte())
        return rlpList(*items.map { item ->
            rlpList(rlpBytes(item.address), rlpList(*item.storageKeys.map { rlpBytes(it) }.toTypedArray()))
        }.toTypedArray())
    }

    private fun minimalBigEndian(value: BigInteger): ByteArray {
        require(value.signum() >= 0) { "RLP integers must be non-negative" }
        if (value.signum() == 0) return byteArrayOf()
        var bytes = value.toByteArray()
        if (bytes.size > 1 && bytes[0] == 0.toByte()) bytes = bytes.copyOfRange(1, bytes.size)
        return bytes
    }

    private fun bigEndianLength(len: Int): ByteArray = minimalBigEndian(BigInteger.valueOf(len.toLong()))

    // ── Curve helpers ───────────────────────────────────────────────────────────

    private fun toFixed32(value: BigInteger): ByteArray {
        val bytes = value.toByteArray()
        val start = if (bytes.size > 32 && bytes[0] == 0.toByte()) 1 else 0
        val length = bytes.size - start
        require(length <= 32) { "value does not fit in 32 bytes" }
        return ByteArray(32).also { out -> System.arraycopy(bytes, start, out, 32 - length, length) }
    }

    private fun decompressPoint(x: BigInteger, oddY: Boolean): ECPoint {
        val fe = CURVE.curve.fromBigInteger(x)
        val rhs = fe.square().add(CURVE.curve.a).multiply(fe).add(CURVE.curve.b)
        var y = rhs.sqrt()
        if (y.testBitZero() != oddY) y = y.negate()
        return CURVE.curve.createPoint(x, y.toBigInteger())
    }
}
