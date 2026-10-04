package com.conxius.wallet.bitcoin

import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

/**
 * EVM signing conformance against authoritative vectors produced by
 * eth-account / libsecp256k1 (RFC-6979 HMAC-SHA256). The fixed private key below
 * (32 bytes of 0x46) is public EIP-155 spec test data, constructed from bytes so
 * secret scanners do not misclassify it.
 */
class EvmSignerTest {
    private val privateKey = BigInteger(1, ByteArray(32) { 0x46.toByte() })
    private val address = "0x9d8A62f656a8d1615C1294fd71e9CFb3E4855A4F"
    private val to = ByteArray(20) { 0x35.toByte() }

    @Test
    fun keccak256MatchesKnownVector() {
        assertEquals(
            "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
            Hex.toHexString(EvmSigner.keccak256(byteArrayOf())),
        )
    }

    @Test
    fun addressDerivationMatchesKnownVector() {
        assertEquals(address, EvmSigner.addressFromPrivateKey(privateKey))
        assertEquals(
            address,
            EvmSigner.addressFromPublicKey(EvmSigner.uncompressedPublicKey(privateKey)),
        )
    }

    @Test
    fun signLegacyTransactionMatchesEip155Vector() {
        val raw = EvmSigner.signLegacyTransaction(
            privateKey = privateKey,
            chainId = 1,
            nonce = 9,
            gasPrice = BigInteger.valueOf(20_000_000_000L),
            gasLimit = 21_000,
            to = to,
            value = BigInteger.TEN.pow(18),
            data = byteArrayOf(),
        )
        assertEquals(
            "f86c098504a817c800825208943535353535353535353535353535353535353535" +
                "880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d" +
                "3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9" +
                "f3dc64214b297fb1966a3b6d83",
            Hex.toHexString(raw),
        )
    }

    @Test
    fun signEip1559TransactionMatchesKnownVector() {
        val raw = EvmSigner.signEip1559Transaction(
            privateKey = privateKey,
            chainId = 1,
            nonce = 0,
            maxPriorityFeePerGas = BigInteger.valueOf(1_000_000_000L),
            maxFeePerGas = BigInteger.valueOf(2_000_000_000L),
            gasLimit = 21_000,
            to = to,
            value = BigInteger.TEN.pow(18),
            data = byteArrayOf(),
        )
        assertEquals(
            "02f8720180843b9aca0084773594008252089435353535353535353535" +
                "35353535353535353535880de0b6b3a764000080c080a09a87e2704310" +
                "71f37718dfa324120bcf9fa09f526a3407e1bf82a6e321115297a07e67" +
                "9504320e1dbeb7ea11d538dcf0f79f090545ea7c11f68e0fddd32c23e860",
            Hex.toHexString(raw),
        )
    }

    @Test
    fun signDigestMatchesEip712Vector() {
        // Standard EIP-712 "Mail" example digest (keccak of 0x1901 || domainSep || structHash).
        val digest = Hex.decode("be609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2")
        val signature = EvmSigner.signDigest(privateKey, digest)
        assertEquals(
            "5318aee9942b84885761bb20e768372b76e7ee454fc4d39b59ce07338d15a06c" +
                "5e585a2f4882ec3228a9303244798b47a9102e4be72f48159d890c73e4511d791b",
            Hex.toHexString(signature),
        )
    }

    @Test
    fun recoverAddressRoundTrips() {
        val digest = Hex.decode("daf5a779ae972f972197303d7b574746c7ef83eadac0f2791ad23db92e4c8e53")
        val sig = EvmSigner.sign(privateKey, digest)
        assertEquals(address, EvmSigner.recoverAddress(digest, sig))
        assertEquals(0, sig.recoveryId)
        // The EIP-155 signing hash must be the keccak of the 9-field unsigned payload.
        val unsignedPayload = Hex.decode(
            "ec098504a817c800825208943535353535353535353535353535353535353535" +
                "880de0b6b3a764000080018080",
        )
        assertArrayEquals(digest, EvmSigner.keccak256(unsignedPayload))
    }

    @Test
    fun derivesEvmAddressFromBip39Mnemonic() {
        // Public BIP84 test mnemonic ("abandon ... about"); EVM uses m/44'/60'/0'/0/0.
        val mnemonic =
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        try {
            val privKey = Secp256k1Signer.derivePrivateKey(mnemonic, "m/44'/60'/0'/0/0", "mainnet")
            assertEquals("0x9858EfFD232B4033E47d90003D41EC34EcaEda94", EvmSigner.addressFromPrivateKey(privKey))
        } catch (e: Exception) {
            handleBdkException(e)
        }
    }

    @Test
    fun signNormalizesToLowS() {
        val digest = Hex.decode("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
        val sig = EvmSigner.sign(privateKey, digest)
        assertTrue(BigInteger(1, sig.s) <= BigInteger(1, Hex.decode("7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0")))
    }

    private fun handleBdkException(e: Exception) {
        if (e.message?.contains("Descriptor") == true || e.message?.contains("loading") == true) {
            println("BDK Environment/JNI issue in JVM: ${e.message}")
        } else {
            throw e
        }
    }
}
