package com.conxius.wallet.bitcoin

import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.math.BigInteger

/**
 * BIP-352 conformance vectors: the receiving vectors from `bip-0352/send_and_receive_test_vectors.json`
 * provide a scan/spend keypair and the expected `sp1...` address. We derive the compressed public
 * keys and assert the codec reproduces the address byte-for-byte.
 */
class SilentPaymentAddressCodecTest {
    private data class Vector(val scanPriv: String, val spendPriv: String, val address: String)

    private val vectors = listOf(
        Vector(
            scanPriv = "0f694e068028a717f8af6b9411f9a133dd3565258714cc226594b34db90c1f2c",
            spendPriv = "9d6ad855ce3417ef84e836892e5a56392bfba05fa5d97ccea30e266f540e08b3",
            address = "sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgqjuexzk6murw56suy3e0rd2cgqvycxttddwsvgxe2usfpxumr70xc9pkqwv",
        ),
        Vector(
            scanPriv = "060b751d7892149006ed7b98606955a29fe284a1e900070c0971f5fb93dbf422",
            spendPriv = "9902c3c56e84002a7cd410113a9ab21d142be7f53cf5200720bb01314c5eb920",
            address = "sp1qqgrz6j0lcqnc04vxccydl0kpsj4frfje0ktmgcl2t346hkw30226xqupawdf48k8882j0strrvcmgg2kdawz53a54dd376ngdhak364hzcmynqtn",
        ),
        Vector(
            scanPriv = "11b7a82e06ca2648d5fded2366478078ec4fc9dc1d8ff487518226f229d768fd",
            spendPriv = "b8f87388cbb41934c50daca018901b00070a5ff6cc25a7e9e716a9d5b9e4d664",
            address = "sp1qqw6vczcfpdh5nf5y2ky99kmqae0tr30hgdfg88parz50cp80wd2wqqauj52ymtc4xdkmx3tgyhrsemg2g3303xk2gtzfy8h8ejet8fz8jcw23zua",
        ),
        // Point-at-infinity edge case (scalars 1 and 2): the address codec is pure key encoding.
        Vector(
            scanPriv = "0000000000000000000000000000000000000000000000000000000000000002",
            spendPriv = "0000000000000000000000000000000000000000000000000000000000000001",
            address = "sp1qqtrqglu5g8kh6mfsg4qxa9wq0nv9cauwfwxw70984wkqnw2uwz0w2qnehen8a7wuhwk9tgrzjh8gwzc8q2dlekedec5djk0js9d3d7qhnq6lqj3s",
        ),
    )

    @Test
    fun bip352VectorsEncode() {
        for (vector in vectors) {
            val address = SilentPaymentAddress.encode(
                compressedPublicKey(vector.scanPriv),
                compressedPublicKey(vector.spendPriv),
                "mainnet",
            )
            assertEquals(vector.address, address)
        }
    }

    @Test
    fun roundTrips() {
        for (vector in vectors) {
            val scanPub = compressedPublicKey(vector.scanPriv)
            val spendPub = compressedPublicKey(vector.spendPriv)
            val decoded = SilentPaymentAddress.decode(vector.address)
            assertArrayEquals(scanPub, decoded.scanPublicKey)
            assertArrayEquals(spendPub, decoded.spendPublicKey)
        }
    }

    @Test
    fun testnetUsesTspHrp() {
        val address = SilentPaymentAddress.encode(
            compressedPublicKey(vectors[0].scanPriv),
            compressedPublicKey(vectors[0].spendPriv),
            "testnet",
        )
        assertEquals("tsp", address.substringBefore('1'))
    }

    @Test
    fun rejectsInvalidInputs() {
        assertThrows(IllegalArgumentException::class.java) {
            SilentPaymentAddress.encode(ByteArray(32), ByteArray(33))
        }
        assertThrows(IllegalArgumentException::class.java) {
            SilentPaymentAddress.encode(
                byteArrayOf(0x04) + ByteArray(32),
                byteArrayOf(0x02) + ByteArray(32),
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            SilentPaymentAddress.decode("sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgqjuexzk6murw56suy3e0rd2cgqvycxttddwsvgxe2usfpxumr70xc9pkqwX")
        }
    }

    private fun compressedPublicKey(privateKeyHex: String): ByteArray =
        Secp256k1Signer.publicKey(BigInteger(1, Hex.decode(privateKeyHex)))
}
