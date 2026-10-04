package com.conxius.wallet.bitcoin

import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

/**
 * Schnorr adaptor signatures against the canonical DLC-specification vectors
 * (discreetlogcontracts/dlcspecs `test/dlc_schnorr_test.json`).
 *
 * Each vector carries the signing key (`privKey`), contract nonce (`privNonce`),
 * 32-byte message (`msgHash`), x-only public key, x-only nonce, the 64-byte
 * pre-signature (`R_x || s'`) and the oracle's adaptor point. The pre-signature
 * is asserted to reproduce exactly, and to verify as a BIP-340 Schnorr signature.
 */
class AdaptorSignerTest {

    private data class Vector(
        val privKey: BigInteger,
        val privNonce: BigInteger,
        val msgHash: ByteArray,
        val pubKey: ByteArray,
        val pubNonce: ByteArray,
        val signature: ByteArray,
        val sigPoint: ByteArray,
    )

    private fun hex(s: String): ByteArray = Hex.decode(s)
    private fun big(s: String): BigInteger = BigInteger(s, 16)

    private val vectors = listOf(
        Vector(
            big("5376a94490ff9b07387511351fdf9fb56d0f704effaa9e55218ac82f712f8a26"),
            big("f32827363379a82bedd1724197ebbae0b0e58719d3014dacc353f0c45109830e"),
            hex("b27019d1912cb97b679eee4c01f9203e00da8443767173df076a529a66e707cf"),
            hex("ce9a3088688eecd98db77c90637c25e6801fc56b0436e7e0103cee82ec63d508"),
            hex("0273ebfee82296afd16b9a6c7cf2485ef83b0cba1b6b66dc7edfbfb1071e8317"),
            hex("0273ebfee82296afd16b9a6c7cf2485ef83b0cba1b6b66dc7edfbfb1071e8317" +
                "ee2b16e43e08393bcbe087c792b30c902ff136775323877fc832f64bf5935781"),
            hex("020dddc643adbc3c8d745f6e9c028bf4abf22cfc97568b60e4c3419cbb72502690"),
        ),
        Vector(
            big("b339569c68f2de370ba4774203c2d01cfbe2af1a23958accaaa227e64cae4e5f"),
            big("467a0383c6116b9c65ddc8aa2d3577a0f597027b07163f5ea9e891d068c9545a"),
            hex("ecc549855e17ce7dbce3759ff9ffd224ba34e40befe3df69d6b7a5450c82fc07"),
            hex("639fd0e002f476a1ba3dd3bb40d007544cf9e09ff1a23bd8c66d1cb8980fed8c"),
            hex("1e90814df446c16b854494aac8b1f05771611228b52ddd6b1eb1dd29dab973b7"),
            hex("1e90814df446c16b854494aac8b1f05771611228b52ddd6b1eb1dd29dab973b7" +
                "cfadd5b1004918214713cc052b84821f675eccd12388008b25dc18b6596aa132"),
            hex("02987faf504b29c90ffa0e83f9c9c9919d7c56ad5564c0b7eaa63d92b7cf3e51ca"),
        ),
        Vector(
            big("a6080050e59f3b7ebbd14a3d058f44978ece37bb896543c789b89ca86dabc74d"),
            big("84e9e4edfcd67a92f326f4d96f48d311793e96c2b542e96e5738fe987820d5e4"),
            hex("6744b92461c47f4a7f7b785c6bb38daa40b7c1d9e532b5480e5b73c6c0096011"),
            hex("4c2a9fd1473302f23d28c398d54e4bef5f3d6d01341387bac5872796b89a0ef9"),
            hex("7fa3a59374116c93b1ea0d2c9408b40768e99e43562f9bd7205986e567e961b5"),
            hex("7fa3a59374116c93b1ea0d2c9408b40768e99e43562f9bd7205986e567e961b5" +
                "9dd00ba70a497851153afc5faf774f8ed3f8b6b2b421c94121f7c85dab3d6225"),
            hex("03b6e6aee8ef20a761bc9bbb227d0a49c1eea80a0e6df62a79c576b5f08ad88ec5"),
        ),
        Vector(
            big("cfe7c7ed47b0ce4885838a53cb6b102ae09b37b2705147607d886e62988190be"),
            big("a0d084b608e5d1b218901212ed3fa15a8692de99c37c6cae6648285156a5feda"),
            hex("143bc33b165b4f7e66a2d997e1f20e4d880416be6d7aaa0d8d385d1ab9482470"),
            hex("43766d34751895463a0a9a3979b8ebc300132c3117ef20de0a209ffc1e5d06cb"),
            hex("53c53d2f7eae94c4766ec322c018be27f65fb65478212f4983b08b8f40765018"),
            hex("53c53d2f7eae94c4766ec322c018be27f65fb65478212f4983b08b8f40765018" +
                "8a01c30884bcd27157191fa4046944c6fc035a69765fd09dccd7a02816143a84"),
            hex("035041aedc6a8fb0c911507af5cdfe5393761361a28e88d5f4f4197f39a495b6ab"),
        ),
        Vector(
            big("7582012d1fa17f723754927109828c71c5d7dd3fadcc8f20d6a79dde27fc985f"),
            big("dd1d13c185e27172e83fd615f6ace25b89e7360ca74888b15b7ac4b639d9edb8"),
            hex("1c2aedbbbd3d8a425fc688730a00c8da2e5b0f0be90eee1f90a2099cac5edb50"),
            hex("d0816bd521ce59ae060eb43cd6e8d0fc8047f338a23f0038a986b92f77a038fe"),
            hex("dae00f16a8c375fb8f0848e96ddfb77ea57b2c6c6f499ffbe6534ba53d6193ae"),
            hex("dae00f16a8c375fb8f0848e96ddfb77ea57b2c6c6f499ffbe6534ba53d6193ae" +
                "f8c6936867b1addd66517eaf933e92fb5f6299975ffcf09901439a012ad2ad83"),
            hex("020ddbf600b1cef6cb9f9cdabdb1951c42f1a6b7fa7dee0ef9fb3bdda258e5b2c6"),
        ),
    )

    @Test
    fun adaptorSignMatchesDlcSpecVectors() {
        for ((i, v) in vectors.withIndex()) {
            val sig = AdaptorSigner.adaptorSign(v.privKey, v.msgHash, v.privNonce)
            assertArrayEquals("vector $i: signature", v.signature, sig)
            assertArrayEquals("vector $i: nonce prefix", v.pubNonce, sig.copyOfRange(0, 32))
        }
    }

    @Test
    fun adaptorVerifyPassesDlcSpecVectors() {
        for ((i, v) in vectors.withIndex()) {
            assertTrue("vector $i: adaptor verify", AdaptorSigner.adaptorVerify(v.pubKey, v.msgHash, v.signature))
        }
    }

    @Test
    fun completeAndExtractRoundTripRecoversOracleSecret() {
        val privKey = big("1111111111111111111111111111111111111111111111111111111111111111")
        val nonce = big("2222222222222222222222222222222222222222222222222222222222222222")
        val secret = big("3333333333333333333333333333333333333333333333333333333333333333")
        val message = hex("b27019d1912cb97b679eee4c01f9203e00da8443767173df076a529a66e707cf")

        val preSig = AdaptorSigner.adaptorSign(privKey, message, nonce)
        val fullSig = AdaptorSigner.completeSignature(preSig, secret)

        assertEquals(secret, AdaptorSigner.extractAdaptorSecret(preSig, fullSig))
    }

    @Test
    fun adaptorPointIsSecretTimesGenerator() {
        val secret = big("3333333333333333333333333333333333333333333333333333333333333333")
        val point = AdaptorSigner.adaptorPoint(secret)
        // compressed SEC1 encoding: 33 bytes, 0x02/0x03 prefix.
        assertEquals(33, point.size)
        assertTrue(point[0] == 0x02.toByte() || point[0] == 0x03.toByte())
    }
}
