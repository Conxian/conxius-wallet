package com.conxius.wallet.bitcoin

import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigInteger

/**
 * Conformance against the official BIP-340 (Schnorr) and BIP-86 (single-key P2TR)
 * test vectors, plus BIP-341 taproot tweak and BIP-350 bech32m.
 *
 * The BIP-86 vectors use the public `abandon … about` mnemonic; the private scalar
 * is derived with BDK via [Secp256k1Signer.derivePrivateKey].
 */
class TaprootSignerTest {
    @Test
    fun bip340Vector0() = assertBip340(
        "0000000000000000000000000000000000000000000000000000000000000003",
        "0000000000000000000000000000000000000000000000000000000000000000",
        "0000000000000000000000000000000000000000000000000000000000000000",
        "E907831F80848D1069A5371B402410364BDF1C5F8307B0084C55F1CE2DCA821525F66A4A85EA8B71E482A74F382D2CE5EBEEE8FDB2172F477DF4900D310536C0",
    )

    @Test
    fun bip340Vector1() = assertBip340(
        "B7E151628AED2A6ABF7158809CF4F3C762E7160F38B4DA56A784D9045190CFEF",
        "0000000000000000000000000000000000000000000000000000000000000001",
        "243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89",
        "6896BD60EEAE296DB48A229FF71DFE071BDE413E6D43F917DC8DCF8C78DE33418906D11AC976ABCCB20B091292BFF4EA897EFCB639EA871CFA95F6DE339E4B0A",
    )

    @Test
    fun bip340Vector2() = assertBip340(
        "C90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B14E5C9",
        "C87AA53824B4D7AE2EB035A2B5BBBCCC080E76CDC6D1692C4B0B62D798E6D906",
        "7E2D58D8B3BCDF1ABADEC7829054F90DDA9805AAB56C77333024B9D0A508B75C",
        "5831AAEED7B44BB74E5EAB94BA9D4294C49BCF2A60728D8B4C200F50DD313C1BAB745879A5AD954A72C45A91C3A51D3C7ADEA98D82F8481E0E1E03674A6F3FB7",
    )

    @Test
    fun bip340Vector3() = assertBip340(
        "0B432B2677937381AEF05BB02A66ECD012773062CF3FA2549E44F58ED2401710",
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        "7EB0509757E246F19449885651611CB965ECC1A187DD51B64FDA1EDC9637D5EC97582B9CB13DB3933705B32BA982AF5AF25FD78881EBB32771FC5922EFC66EA3",
    )

    private fun assertBip340(seckey: String, aux: String, msg: String, expected: String) {
        val sig = TaprootSigner.schnorrSign(BigInteger(1, Hex.decode(seckey)), Hex.decode(msg), Hex.decode(aux))
        assertEquals(expected, Hex.toHexString(sig).uppercase())
    }

    @Test
    fun bip86Vector1() = assertBip86(
        "m/86'/0'/0'/0/0",
        "cc8a4bc64d897bddc5fbc2f670f7a8ba0b386779106cf1223c6fc5d7cd6fc115",
        "a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c",
        "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
    )

    @Test
    fun bip86Vector2() = assertBip86(
        "m/86'/0'/0'/0/1",
        "83dfe85a3151d2517290da461fe2815591ef69f2b18a2ce63f01697a8b313145",
        "a82f29944d65b86ae6b5e5cc75e294ead6c59391a1edc5e016e3498c67fc7bbb",
        "bc1p4qhjn9zdvkux4e44uhx8tc55attvtyu358kutcqkudyccelu0was9fqzwh",
    )

    @Test
    fun bip86Vector3() = assertBip86(
        "m/86'/0'/0'/1/0",
        "399f1b2f4393f29a18c937859c5dd8a77350103157eb880f02e8c08214277cef",
        "882d74e5d0572d5a816cef0041a96b6c1de832f6f9676d9605c44d5e9a97d3dc",
        "bc1p3qkhfews2uk44qtvauqyr2ttdsw7svhkl9nkm9s9c3x4ax5h60wqwruhk7",
    )

    private fun assertBip86(path: String, internal: String, output: String, address: String) {
        val mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        val priv = Secp256k1Signer.derivePrivateKey(mnemonic, path, "mainnet")
        val xOnly = TaprootSigner.xOnlyPublicKey(priv)
        assertEquals(internal, Hex.toHexString(xOnly))
        val outKey = TaprootSigner.taprootOutputKey(xOnly)
        assertEquals(output, Hex.toHexString(outKey))
        assertEquals(address, TaprootSigner.p2trAddress(outKey, "mainnet"))
    }
}
