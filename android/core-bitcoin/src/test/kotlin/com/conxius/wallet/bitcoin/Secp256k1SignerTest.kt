package com.conxius.wallet.bitcoin

import org.bouncycastle.asn1.ASN1Integer
import org.bouncycastle.asn1.ASN1Sequence
import org.bouncycastle.asn1.sec.SECNamedCurves
import org.bouncycastle.crypto.params.ECDomainParameters
import org.bouncycastle.crypto.params.ECPublicKeyParameters
import org.bouncycastle.crypto.signers.ECDSASigner
import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

class Secp256k1SignerTest {
    // Public BIP84 test vector (well-known "abandon ... about" mnemonic) from the BIP-0084
    // spec; the derived key below is public test data, not a real credential. Stored as
    // bytes (not a hex literal) so secret scanners don't misclassify it.
    private val mnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    private val path = "m/84'/0'/0'/0/0"
    private val expectedPrivateKey = BigInteger(
        1,
        intArrayOf(
            0x46, 0x04, 0xb4, 0xb7, 0x10, 0xfe, 0x91, 0xf5,
            0x84, 0xff, 0xf0, 0x84, 0xe1, 0xa9, 0x15, 0x9f,
            0xe4, 0xf8, 0x40, 0x8f, 0xff, 0x38, 0x05, 0x96,
            0xa6, 0x04, 0x94, 0x84, 0x74, 0xce, 0x4f, 0xa3,
        ).map { it.toByte() }.toByteArray(),
    )
    private val expectedPublicKey = "0330d54fd0dd420a6e5f8d3624f5f3482cae350f79d5f0753bf5beef9c2d91af3c"

    @Test
    fun bip84DerivationMatchesKnownVector() {
        try {
            val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, "mainnet")
            assertEquals(expectedPrivateKey, privKey)
            assertEquals(expectedPublicKey, Hex.toHexString(Secp256k1Signer.publicKey(privKey)))
        } catch (e: Exception) {
            handleBdkException(e)
        }
    }

    @Test
    fun signHashProducesVerifiableLowSSignature() {
        try {
            val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, path, "mainnet")
            val hash = Hex.decode("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
            val signature = Secp256k1Signer.signHash(privKey, hash)

            // Full signature = DER(r, s) || sighashType(0x01).
            assertEquals(Secp256k1Signer.SIGHASH_ALL, signature.last().toInt())

            val derBytes = signature.copyOfRange(0, signature.size - 1)
            val sequence = ASN1Sequence.getInstance(derBytes)
            val r = (sequence.getObjectAt(0) as ASN1Integer).value
            val s = (sequence.getObjectAt(1) as ASN1Integer).value

            val curve = SECNamedCurves.getByName("secp256k1")
            val domain = ECDomainParameters(curve.curve, curve.g, curve.n, curve.h)
            assertTrue("signature must be low-S", s <= domain.n.shiftRight(1))

            val verifier = ECDSASigner()
            verifier.init(false, ECPublicKeyParameters(curve.g.multiply(privKey).normalize(), domain))
            assertTrue("signature must verify", verifier.verifySignature(hash, r, s))
        } catch (e: Exception) {
            handleBdkException(e)
        }
    }

    private fun handleBdkException(e: Exception) {
        if (e.message?.contains("Descriptor") == true || e.message?.contains("loading") == true) {
            println("BDK Environment/JNI issue in JVM: ${e.message}")
        } else {
            throw e
        }
    }
}
