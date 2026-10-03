package com.conxius.wallet.bitcoin

import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigInteger

/**
 * Conformance against @stacks/transactions v7.6.0 and Node crypto.
 *
 * Reference key is the canonical EIP-155 test key `0x46…46`; all expected values
 * below were generated with the @stacks/transactions library (SIP-005 c32check
 * address and SIP-018 SHA512/256 recoverable signature).
 */
class StacksSignerTest {
    private val privateKey = BigInteger("4646464646464646464646464646464646464646464646464646464646464646", 16)

    @Test
    fun sha512256MatchesReference() {
        val digest = StacksSigner.sha512256("hello stacks".toByteArray(Charsets.UTF_8))
        assertEquals(
            "1e0420fe222473079aaf97c19fcf725a19cdf969b1c8095d36e44b5892be52e6",
            Hex.toHexString(digest),
        )
    }

    @Test
    fun hash160MatchesReference() {
        val uncompressed = EvmSigner.uncompressedPublicKey(privateKey)
        assertEquals(
            "57cc333337a08ba23d9a04caaadb3323d762273f",
            Hex.toHexString(StacksSigner.hash160(uncompressed)),
        )
    }

    @Test
    fun mainnetAddressMatchesReference() {
        assertEquals(
            "SP1BWRCSK6YG8Q8HXK82CNAPV6CHXERH77Y4THYDJ",
            StacksSigner.addressFromPrivateKey(privateKey, testnet = false),
        )
    }

    @Test
    fun testnetAddressMatchesReference() {
        assertEquals(
            "ST1BWRCSK6YG8Q8HXK82CNAPV6CHXERH77Y93DQRK",
            StacksSigner.addressFromPrivateKey(privateKey, testnet = true),
        )
    }

    @Test
    fun signDigestReturnsRecoverableRsv() {
        val digest = Hex.decode("1e0420fe222473079aaf97c19fcf725a19cdf969b1c8095d36e44b5892be52e6")
        val sig = StacksSigner.signDigest(privateKey, digest)
        assertEquals(
            "6458657568c5d8685aa37eaa9de56421cac1caf2538fc5e7a14624930dd00372" +
                "0c752ac042b29c62e273d2730fcfe6bbc91fe177c0c5d8b61121bdc9b6084aca" +
                "00",
            Hex.toHexString(sig),
        )
    }
}
