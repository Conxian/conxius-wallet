package com.conxius.wallet.bitcoin

import org.bouncycastle.asn1.sec.SECNamedCurves
import org.bouncycastle.asn1.x9.X9ECParameters
import org.bouncycastle.crypto.digests.SHA256Digest
import java.math.BigInteger

/**
 * Native Taproot signing primitives (BIP-340 / BIP-341 / BIP-350 / BIP-86).
 *
 * All of these are activated/final BIPs. BIP-340 (Schnorr) signs the keypath
 * spend of a BIP-341 taproot output; BIP-86 defines single-key P2TR derivation
 * (`m/86'/0'/0'/0/0`), and BIP-350 defines the bech32m address encoding for v1+
 * witness outputs.
 *
 * Stateless and secret-safe: private scalars are passed in by the caller, never
 * logged or persisted. Conformance vectors (BIP-340 and BIP-86) are asserted in
 * [TaprootSignerTest].
 */
object TaprootSigner {
    private val CURVE: X9ECParameters = SECNamedCurves.getByName("secp256k1")
    private val N: BigInteger = CURVE.n

    // ── BIP-340 x-only key + Schnorr signing ─────────────────────────────────

    /** 32-byte x-only (BIP-340) public key for a private scalar. */
    fun xOnlyPublicKey(privateKey: BigInteger): ByteArray {
        val p = CURVE.g.multiply(privateKey).normalize()
        return xOnlyBytes(p)
    }

    /**
     * BIP-340 Schnorr signature (64 bytes: `R_x || s`). [auxRand] is a 32-byte
     * auxiliary randomness; use 32 zero bytes when none is available.
     */
    fun schnorrSign(privateKey: BigInteger, message: ByteArray, auxRand: ByteArray): ByteArray {
        require(message.size == 32) { "BIP-340 message must be 32 bytes" }
        require(auxRand.size == 32) { "BIP-340 auxRand must be 32 bytes" }
        val d0 = privateKey.mod(N)
        val p = CURVE.g.multiply(d0).normalize()
        val d = if (hasEvenY(p)) d0 else N.subtract(d0)
        val t = xorBytes(to32Bytes(d), taggedHash("BIP0340/aux", auxRand))
        val k0 = BigInteger(1, taggedHash("BIP0340/nonce", t + xOnlyBytes(p) + message)).mod(N)
        val r = CURVE.g.multiply(k0).normalize()
        val k = if (hasEvenY(r)) k0 else N.subtract(k0)
        val e = BigInteger(1, taggedHash("BIP0340/challenge", xOnlyBytes(r) + xOnlyBytes(p) + message)).mod(N)
        val s = k.add(e.multiply(d)).mod(N)
        return xOnlyBytes(r) + to32Bytes(s)
    }

    /**
     * BIP-340 Schnorr verification. Returns true iff [signature] (64 bytes:
     * `R_x || s`) is a valid signature by the x-only [pubkeyXOnly] over the
     * 32-byte [message].
     */
    fun schnorrVerify(pubkeyXOnly: ByteArray, message: ByteArray, signature: ByteArray): Boolean {
        require(message.size == 32) { "BIP-340 message must be 32 bytes" }
        require(pubkeyXOnly.size == 32) { "BIP-340 pubkey must be 32 bytes" }
        require(signature.size == 64) { "BIP-340 signature must be 64 bytes" }
        val rBytes = signature.copyOfRange(0, 32)
        val sBytes = signature.copyOfRange(32, 64)
        val r = BigInteger(1, rBytes)
        val s = BigInteger(1, sBytes)
        if (r.signum() <= 0 || r >= N || s.signum() <= 0 || s >= N) return false
        val P = try {
            liftX(pubkeyXOnly)
        } catch (e: IllegalArgumentException) {
            return false
        }
        val R = try {
            liftX(rBytes)
        } catch (e: IllegalArgumentException) {
            return false
        }
        val e = BigInteger(1, taggedHash("BIP0340/challenge", rBytes + pubkeyXOnly + message)).mod(N)
        val lhs = CURVE.g.multiply(s).normalize()
        val rhs = R.add(P.multiply(e)).normalize()
        return lhs == rhs
    }

    // ── BIP-341 taproot output key ───────────────────────────────────────────

    /** BIP-341 taproot tweak: `output = internal + int(hash_TapTweak(internal))·G`. */
    fun taprootOutputKey(internalKeyXOnly: ByteArray): ByteArray {
        val t = BigInteger(1, taggedHash("TapTweak", internalKeyXOnly)).mod(N)
        val p = liftX(internalKeyXOnly)
        val q = p.add(CURVE.g.multiply(t)).normalize()
        return xOnlyBytes(q)
    }

    // ── BIP-86 / BIP-350 P2TR address ────────────────────────────────────────

    /** bech32m P2TR address for a 32-byte x-only taproot output key. */
    fun p2trAddress(outputKeyXOnly: ByteArray, network: String = "mainnet"): String {
        val data = convertBits(outputKeyXOnly, 8, 5, true)
        val withVersion = IntArray(data.size + 1)
        withVersion[0] = 1
        data.copyInto(withVersion, 1)
        return bech32mEncode(hrpFor(network), withVersion)
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    private fun hrpFor(network: String): String = when (network) {
        "testnet", "signet" -> "tb"
        "regtest" -> "bcrt"
        else -> "bc"
    }

    private fun sha256(data: ByteArray): ByteArray {
        val d = SHA256Digest()
        d.update(data, 0, data.size)
        val out = ByteArray(d.digestSize)
        d.doFinal(out, 0)
        return out
    }

    private fun taggedHash(tag: String, msg: ByteArray): ByteArray {
        val tagHash = sha256(tag.toByteArray(Charsets.US_ASCII))
        return sha256(tagHash + tagHash + msg)
    }

    private fun xOnlyBytes(p: org.bouncycastle.math.ec.ECPoint): ByteArray =
        to32Bytes(p.normalize().affineXCoord.toBigInteger())

    private fun hasEvenY(p: org.bouncycastle.math.ec.ECPoint): Boolean =
        !p.normalize().affineYCoord.toBigInteger().testBit(0)

    /** BIP-340 lift_x: decode the compressed point `0x02 || x` (even y). */
    private fun liftX(x: ByteArray): org.bouncycastle.math.ec.ECPoint =
        CURVE.curve.decodePoint(byteArrayOf(0x02) + x)

    private fun to32Bytes(v: BigInteger): ByteArray {
        val raw = v.toByteArray()
        var start = 0
        while (start < raw.size - 1 && raw[start] == 0.toByte()) start++
        val significant = raw.copyOfRange(start, raw.size)
        val out = ByteArray(32)
        System.arraycopy(significant, 0, out, 32 - significant.size, significant.size)
        return out
    }

    private fun xorBytes(a: ByteArray, b: ByteArray): ByteArray {
        val out = ByteArray(32)
        for (i in 0 until 32) out[i] = (a[i].toInt() xor b[i].toInt()).toByte()
        return out
    }

    // ── BIP-350 bech32m ──────────────────────────────────────────────────────

    private const val BECH32M_CONST = 0x2bc830a3
    private const val CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
    private val GEN = intArrayOf(0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)

    private fun bech32mEncode(hrp: String, data: IntArray): String {
        val expanded = hrpExpand(hrp)
        val combined = IntArray(expanded.size + data.size + 6)
        expanded.copyInto(combined, 0)
        data.copyInto(combined, expanded.size)
        val check = polymod(combined) xor BECH32M_CONST
        val sb = StringBuilder(hrp).append('1')
        for (d in data) sb.append(CHARSET[d])
        for (i in 0 until 6) sb.append(CHARSET[(check ushr (5 * (5 - i))) and 31])
        return sb.toString()
    }

    private fun hrpExpand(hrp: String): IntArray {
        val out = IntArray(hrp.length * 2 + 1)
        var idx = 0
        for (i in hrp.indices) out[idx++] = hrp[i].code ushr 5
        out[idx++] = 0
        for (i in hrp.indices) out[idx++] = hrp[i].code and 31
        return out
    }

    private fun convertBits(data: ByteArray, fromBits: Int, toBits: Int, pad: Boolean): IntArray {
        var acc = 0
        var bits = 0
        val maxv = (1 shl toBits) - 1
        val ret = mutableListOf<Int>()
        for (value in data) {
            acc = (acc shl fromBits) or (value.toInt() and 0xff)
            bits += fromBits
            while (bits >= toBits) {
                bits -= toBits
                ret.add((acc ushr bits) and maxv)
            }
        }
        if (pad && bits > 0) ret.add((acc shl (toBits - bits)) and maxv)
        return ret.toIntArray()
    }

    private fun polymod(values: IntArray): Int {
        var chk = 1
        for (v in values) {
            val top = chk ushr 25
            chk = ((chk and 0x1ffffff) shl 5) xor v
            for (i in 0 until 5) {
                if (((top ushr i) and 1) == 1) chk = chk xor GEN[i]
            }
        }
        return chk
    }
}
