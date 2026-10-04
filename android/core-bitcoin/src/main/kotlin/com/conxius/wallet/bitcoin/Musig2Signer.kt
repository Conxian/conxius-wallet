package com.conxius.wallet.bitcoin

import org.bouncycastle.asn1.sec.SECNamedCurves
import org.bouncycastle.asn1.x9.X9ECParameters
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.math.ec.ECPoint
import java.math.BigInteger

/**
 * Native MuSig2 primitives (BIP-327).
 *
 * Implements key aggregation, nonce generation/aggregation, partial signing,
 * partial-signature verification, and final signature aggregation exactly as
 * specified by BIP-327 (v1.0.4, status: deployed). MuSig2 is an n-of-n scheme
 * that produces ordinary BIP-340 Schnorr signatures valid under an aggregate
 * x-only public key, and is the crypto foundation for later DLC/NWC phases.
 *
 * Stateless and secret-safe: private scalars are passed in by the caller and
 * never logged or persisted. Conformance vectors from the BIP-327 repository
 * are asserted in [Musig2SignerTest].
 */
object Musig2Signer {
    private val CURVE: X9ECParameters = SECNamedCurves.getByName("secp256k1")
    private val N: BigInteger = CURVE.n
    private val G: ECPoint = CURVE.g
    private val INFINITY: ECPoint = CURVE.curve.infinity

    /** KeyAgg context: tweaked aggregate point plus accumulated sign/tweak. */
    data class KeyAggContext(val q: ECPoint, val gacc: BigInteger, val tacc: BigInteger)

    /** Session values derived from the aggregate nonce, keys and message. */
    private data class SessionValues(
        val q: ECPoint,
        val gacc: BigInteger,
        val tacc: BigInteger,
        val b: BigInteger,
        val r: ECPoint,
        val e: BigInteger,
    )

    // ── Public API ──────────────────────────────────────────────────────────

    /** BIP-327 KeySort: lexicographic order over the 33-byte compressed keys. */
    fun keySort(pubkeys: List<ByteArray>): List<ByteArray> =
        pubkeys.sortedWith { a, b ->
            for (i in 0 until 33) {
                val cmp = (a[i].toInt() and 0xff).compareTo(b[i].toInt() and 0xff)
                if (cmp != 0) return@sortedWith cmp
            }
            0
        }

    /** KeyAgg + GetXonlyPubkey: 32-byte x-only aggregate public key. */
    fun keyAggregate(pubkeys: List<ByteArray>): ByteArray =
        xbytes(keyAgg(pubkeys).q)

    /** KeyAgg + tweaks + GetXonlyPubkey: aggregate key after [tweaks]. */
    fun keyAggregateTweaked(
        pubkeys: List<ByteArray>,
        tweaks: List<ByteArray>,
        isXonly: List<Boolean>,
    ): ByteArray {
        var ctx = keyAgg(pubkeys)
        for (i in tweaks.indices) ctx = applyTweak(ctx, tweaks[i], isXonly[i])
        return xbytes(ctx.q)
    }

    /**
     * BIP-327 NonceGen. [random] is the 32-byte `rand'` (must be freshly drawn
     * uniform randomness in production). Returns (secnonce, pubnonce).
     */
    fun nonceGen(
        sk: ByteArray?,
        pk: ByteArray,
        aggpk: ByteArray?,
        m: ByteArray?,
        extraIn: ByteArray?,
        random: ByteArray,
    ): Pair<ByteArray, ByteArray> {
        require(random.size == 32) { "rand' must be 32 bytes" }
        val rand = if (sk != null) xorBytes(sk, taggedHash("MuSig/aux", random)) else random
        val aggpkEff = aggpk ?: ByteArray(0)
        val mPrefixed = when {
            m == null -> byteArrayOf(0)
            else -> byteArrayOf(1) + bytes(8, m.size.toLong()) + m
        }
        val extra = extraIn ?: ByteArray(0)
        val secnonce = ByteArray(97)
        val pubnonce = ByteArray(66)
        for (i in 1..2) {
            val k = BigInteger(
                1,
                taggedHash(
                    "MuSig/nonce",
                    rand + bytes(1, pk.size.toLong()) + pk +
                        bytes(1, aggpkEff.size.toLong()) + aggpkEff +
                        mPrefixed + bytes(4, extra.size.toLong()) + extra +
                        byteArrayOf((i - 1).toByte()),
                ),
            ).mod(N)
            require(k.signum() != 0) { "nonce must be non-zero" }
            val r = G.multiply(k).normalize()
            val kBytes = to32Bytes(k)
            System.arraycopy(kBytes, 0, secnonce, (i - 1) * 32, 32)
            System.arraycopy(cbytes(r), 0, pubnonce, (i - 1) * 33, 33)
        }
        System.arraycopy(pk, 0, secnonce, 64, 33)
        return Pair(secnonce, pubnonce)
    }

    /** BIP-327 NonceAgg: 66-byte aggregate nonce from u pubnonces. */
    fun nonceAggregate(pubnonces: List<ByteArray>): ByteArray {
        var r1 = INFINITY
        var r2 = INFINITY
        for (pn in pubnonces) {
            r1 = r1.add(cpoint(pn.copyOfRange(0, 33)))
            r2 = r2.add(cpoint(pn.copyOfRange(33, 66)))
        }
        return cbytes(r1) + cbytes(r2)
    }

    /** BIP-327 Sign: produce the 32-byte partial signature for one signer. */
    fun signPartial(
        secnonce: ByteArray,
        sk: ByteArray,
        aggnonce: ByteArray,
        pubkeys: List<ByteArray>,
        tweaks: List<ByteArray>,
        isXonly: List<Boolean>,
        m: ByteArray,
    ): ByteArray {
        require(secnonce.size == 97) { "secnonce must be 97 bytes" }
        val sv = getSessionValues(aggnonce, pubkeys, tweaks, isXonly, m)
        val k1Prime = BigInteger(1, secnonce.copyOfRange(0, 32))
        val k2Prime = BigInteger(1, secnonce.copyOfRange(32, 64))
        require(k1Prime.signum() != 0 && k1Prime < N && k2Prime.signum() != 0 && k2Prime < N) {
            "invalid secnonce"
        }
        val k1 = if (hasEvenY(sv.r)) k1Prime else N.subtract(k1Prime)
        val k2 = if (hasEvenY(sv.r)) k2Prime else N.subtract(k2Prime)
        val dPrime = BigInteger(1, sk)
        require(dPrime.signum() != 0 && dPrime < N) { "invalid secret key" }
        val p = G.multiply(dPrime).normalize()
        val pk = cbytes(p)
        require(pk.contentEquals(secnonce.copyOfRange(64, 97))) {
            "secnonce pk does not match secret key"
        }
        val a = keyAggCoeff(pubkeys, pk)
        val g = if (hasEvenY(sv.q)) BigInteger.ONE else N.subtract(BigInteger.ONE)
        val d = g.multiply(sv.gacc).multiply(dPrime).mod(N)
        val s = k1.add(sv.b.multiply(k2)).add(sv.e.multiply(a).multiply(d)).mod(N)
        return to32Bytes(s)
    }

    /** BIP-327 PartialSigVerify: blame-free boolean check of a partial sig. */
    fun partialSigVerify(
        psig: ByteArray,
        pubnonce: ByteArray,
        pubnonces: List<ByteArray>,
        pubkeys: List<ByteArray>,
        tweaks: List<ByteArray>,
        isXonly: List<Boolean>,
        m: ByteArray,
        signerIndex: Int,
    ): Boolean {
        val aggnonce = nonceAggregate(pubnonces)
        val sv = getSessionValues(aggnonce, pubkeys, tweaks, isXonly, m)
        val s = BigInteger(1, psig)
        if (s >= N) return false
        val r1 = cpoint(pubnonce.copyOfRange(0, 33))
        val r2 = cpoint(pubnonce.copyOfRange(33, 66))
        val rePrime = r1.add(r2.multiply(sv.b))
        val re = if (hasEvenY(sv.r)) rePrime else rePrime.negate()
        val p = cpoint(pubkeys[signerIndex])
        val a = keyAggCoeff(pubkeys, pubkeys[signerIndex])
        val g = if (hasEvenY(sv.q)) BigInteger.ONE else N.subtract(BigInteger.ONE)
        val gPrime = g.multiply(sv.gacc).mod(N)
        return G.multiply(s).normalize() == re.add(p.multiply(sv.e.multiply(a).multiply(gPrime))).normalize()
    }

    /** BIP-327 PartialSigAgg: 64-byte BIP-340 signature from partial sigs. */
    fun partialSigAggregate(
        psigs: List<ByteArray>,
        aggnonce: ByteArray,
        pubkeys: List<ByteArray>,
        tweaks: List<ByteArray>,
        isXonly: List<Boolean>,
        m: ByteArray,
    ): ByteArray {
        val sv = getSessionValues(aggnonce, pubkeys, tweaks, isXonly, m)
        var s = BigInteger.ZERO
        for (psig in psigs) {
            val si = BigInteger(1, psig)
            require(si < N) { "invalid partial signature" }
            s = s.add(si)
        }
        val g = if (hasEvenY(sv.q)) BigInteger.ONE else N.subtract(BigInteger.ONE)
        s = s.add(sv.e.multiply(g).multiply(sv.tacc)).mod(N)
        return xbytes(sv.r) + to32Bytes(s)
    }

    /** 32-byte big-endian scalar encoding of a secret key value. */
    fun secretScalar(secret: BigInteger): ByteArray = to32Bytes(secret.mod(N))

    // ── Key aggregation internals ───────────────────────────────────────────

    private fun keyAgg(pubkeys: List<ByteArray>): KeyAggContext {
        require(pubkeys.isNotEmpty()) { "at least one pubkey required" }
        val pk2 = secondKey(pubkeys)
        var q = INFINITY
        for (pk in pubkeys) {
            val p = cpoint(pk)
            val a = keyAggCoeffInternal(pubkeys, pk, pk2)
            q = q.add(p.multiply(a))
        }
        require(!q.isInfinity) { "aggregate key is point at infinity" }
        return KeyAggContext(q.normalize(), BigInteger.ONE, BigInteger.ZERO)
    }

    private fun applyTweak(ctx: KeyAggContext, tweak: ByteArray, isXonly: Boolean): KeyAggContext {
        val g = if (isXonly && !hasEvenY(ctx.q)) N.subtract(BigInteger.ONE) else BigInteger.ONE
        val t = BigInteger(1, tweak)
        require(t < N) { "tweak must be less than n" }
        val qPrime = ctx.q.multiply(g).add(G.multiply(t))
        require(!qPrime.isInfinity) { "tweaked key is point at infinity" }
        return KeyAggContext(
            qPrime.normalize(),
            g.multiply(ctx.gacc).mod(N),
            t.add(g.multiply(ctx.tacc)).mod(N),
        )
    }

    private fun secondKey(pubkeys: List<ByteArray>): ByteArray {
        for (j in 1 until pubkeys.size) {
            if (!pubkeys[j].contentEquals(pubkeys[0])) return pubkeys[j]
        }
        return ByteArray(33)
    }

    private fun hashKeys(pubkeys: List<ByteArray>): ByteArray {
        var concat = ByteArray(0)
        for (pk in pubkeys) concat += pk
        return taggedHash("KeyAgg list", concat)
    }

    private fun keyAggCoeffInternal(pubkeys: List<ByteArray>, pk: ByteArray, pk2: ByteArray): BigInteger =
        if (pk.contentEquals(pk2)) {
            BigInteger.ONE
        } else {
            BigInteger(1, taggedHash("KeyAgg coefficient", hashKeys(pubkeys) + pk)).mod(N)
        }

    private fun keyAggCoeff(pubkeys: List<ByteArray>, pk: ByteArray): BigInteger =
        keyAggCoeffInternal(pubkeys, pk, secondKey(pubkeys))

    // ── Session values ──────────────────────────────────────────────────────

    private fun getSessionValues(
        aggnonce: ByteArray,
        pubkeys: List<ByteArray>,
        tweaks: List<ByteArray>,
        isXonly: List<Boolean>,
        m: ByteArray,
    ): SessionValues {
        var ctx = keyAgg(pubkeys)
        for (i in tweaks.indices) ctx = applyTweak(ctx, tweaks[i], isXonly[i])
        val b = BigInteger(1, taggedHash("MuSig/noncecoef", aggnonce + xbytes(ctx.q) + m)).mod(N)
        val r1 = cpointExt(aggnonce.copyOfRange(0, 33))
        val r2 = cpointExt(aggnonce.copyOfRange(33, 66))
        val rPrime = r1.add(r2.multiply(b))
        val r = if (rPrime.isInfinity) G else rPrime.normalize()
        val e = BigInteger(1, taggedHash("BIP0340/challenge", xbytes(r) + xbytes(ctx.q) + m)).mod(N)
        return SessionValues(ctx.q, ctx.gacc, ctx.tacc, b, r, e)
    }

    // ── Elliptic-curve / serialization helpers ──────────────────────────────

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

    private fun xbytes(p: ECPoint): ByteArray = to32Bytes(p.normalize().affineXCoord.toBigInteger())

    private fun hasEvenY(p: ECPoint): Boolean = !p.normalize().affineYCoord.toBigInteger().testBit(0)

    private fun cpoint(bytes33: ByteArray): ECPoint = CURVE.curve.decodePoint(bytes33).normalize()

    private fun cpointExt(bytes33: ByteArray): ECPoint =
        if (bytes33.all { it == 0.toByte() }) INFINITY else cpoint(bytes33)

    private fun cbytes(p: ECPoint): ByteArray =
        if (p.isInfinity) ByteArray(33) else p.normalize().getEncoded(true)

    private fun to32Bytes(v: BigInteger): ByteArray {
        val raw = v.toByteArray()
        var start = 0
        while (start < raw.size - 1 && raw[start] == 0.toByte()) start++
        val significant = raw.copyOfRange(start, raw.size)
        val out = ByteArray(32)
        System.arraycopy(significant, 0, out, 32 - significant.size, significant.size)
        return out
    }

    private fun bytes(n: Int, value: Long): ByteArray {
        val out = ByteArray(n)
        var v = value
        for (i in n - 1 downTo 0) {
            out[i] = (v and 0xffL).toByte()
            v = v ushr 8
        }
        return out
    }

    private fun xorBytes(a: ByteArray, b: ByteArray): ByteArray {
        val out = ByteArray(32)
        for (i in 0 until 32) out[i] = (a[i].toInt() xor b[i].toInt()).toByte()
        return out
    }
}
