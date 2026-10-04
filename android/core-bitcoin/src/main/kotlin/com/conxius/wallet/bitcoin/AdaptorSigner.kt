package com.conxius.wallet.bitcoin

import org.bouncycastle.asn1.sec.SECNamedCurves
import org.bouncycastle.asn1.x9.X9ECParameters
import java.math.BigInteger

/**
 * Schnorr adaptor signatures (DLC / PTLC foundation).
 *
 * An adaptor signature is a BIP-340 Schnorr pre-signature `(R_x, s')` where
 * `s' = k + e·d`. The full contract signature is obtained by adding the
 * oracle's one-time secret `t` (`s = s' + t`), and — because `s - s' = t` —
 * anyone who sees both the pre-signature and the full signature learns `t`.
 * That is the mechanism by which a DLC oracle's attestation "decrypts" a
 * contract execution transaction.
 *
 * The scheme is specified by the DLC specification (discreetlogcontracts/
 * dlcspecs), whose Schnorr adaptor vectors are asserted in [AdaptorSignerTest].
 * It reuses the exact BIP-340 challenge (`R_x || P_x || m`), so the
 * pre-signature is a plain Schnorr signature produced with an explicit nonce.
 *
 * Stateless and secret-safe: private scalars are passed in by the caller and
 * never logged or persisted.
 */
object AdaptorSigner {
    private val CURVE: X9ECParameters = SECNamedCurves.getByName("secp256k1")
    private val N: BigInteger = CURVE.n

    /** Produces a 64-byte adaptor pre-signature `R_x || s'` with explicit [nonce]. */
    fun adaptorSign(privateKey: BigInteger, message: ByteArray, nonce: BigInteger): ByteArray =
        TaprootSigner.schnorrSignWithNonce(privateKey, message, nonce)

    /** Verifies an adaptor pre-signature as a BIP-340 Schnorr signature. */
    fun adaptorVerify(pubkeyXOnly: ByteArray, message: ByteArray, adaptorSignature: ByteArray): Boolean =
        TaprootSigner.schnorrVerify(pubkeyXOnly, message, adaptorSignature)

    /** One-time adaptor point `T = t·G` (33-byte compressed) for an oracle secret `t`. */
    fun adaptorPoint(adaptorSecret: BigInteger): ByteArray =
        CURVE.g.multiply(adaptorSecret.mod(N)).normalize().getEncoded(true)

    /** Completes a pre-signature `(R_x, s')` with the oracle secret `t` → `(R_x, s' + t)`. */
    fun completeSignature(adaptorSignature: ByteArray, adaptorSecret: BigInteger): ByteArray {
        require(adaptorSignature.size == 64) { "adaptor signature must be 64 bytes" }
        val sPrime = BigInteger(1, adaptorSignature.copyOfRange(32, 64))
        val s = sPrime.add(adaptorSecret).mod(N)
        return adaptorSignature.copyOfRange(0, 32) + to32Bytes(s)
    }

    /** Recovers the oracle secret `t = s - s'` from the pre- and full signatures. */
    fun extractAdaptorSecret(adaptorSignature: ByteArray, fullSignature: ByteArray): BigInteger {
        require(adaptorSignature.size == 64) { "adaptor signature must be 64 bytes" }
        require(fullSignature.size == 64) { "full signature must be 64 bytes" }
        require(adaptorSignature.copyOfRange(0, 32).contentEquals(fullSignature.copyOfRange(0, 32))) {
            "nonce mismatch: signatures must share R_x"
        }
        val sPrime = BigInteger(1, adaptorSignature.copyOfRange(32, 64))
        val s = BigInteger(1, fullSignature.copyOfRange(32, 64))
        return s.subtract(sPrime).mod(N)
    }

    private fun to32Bytes(v: BigInteger): ByteArray {
        val raw = v.toByteArray()
        var start = 0
        while (start < raw.size - 1 && raw[start] == 0.toByte()) start++
        val significant = raw.copyOfRange(start, raw.size)
        val out = ByteArray(32)
        System.arraycopy(significant, 0, out, 32 - significant.size, significant.size)
        return out
    }
}
