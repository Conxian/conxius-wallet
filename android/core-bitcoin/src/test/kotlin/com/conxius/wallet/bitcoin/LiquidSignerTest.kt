package com.conxius.wallet.bitcoin

import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigInteger

/**
 * Conformance against liquidjs-lib (P2WPKH bech32 addresses) and RFC-6979
 * secp256k1 (Elements sighash signing). Reference key is the canonical EIP-155
 * test key `0x46…46`.
 */
class LiquidSignerTest {
    private val privateKey = BigInteger("4646464646464646464646464646464646464646464646464646464646464646", 16)

    @Test
    fun mainnetAddressMatchesReference() {
        assertEquals(
            "ex1qhkfq3zahaqkkzx5mjnamwjsfpq2jk7z09gus9v",
            LiquidSigner.addressFromPrivateKey(privateKey, "mainnet"),
        )
    }

    @Test
    fun testnetAddressMatchesReference() {
        assertEquals(
            "tex1qhkfq3zahaqkkzx5mjnamwjsfpq2jk7z0lwwee8",
            LiquidSigner.addressFromPrivateKey(privateKey, "testnet"),
        )
    }

    @Test
    fun regtestAddressMatchesReference() {
        assertEquals(
            "ert1qhkfq3zahaqkkzx5mjnamwjsfpq2jk7z0l6kg6k",
            LiquidSigner.addressFromPrivateKey(privateKey, "regtest"),
        )
    }

    @Test
    fun signDigestReturnsDerWithSighashAll() {
        val sighash = Hex.decode("1e0420fe222473079aaf97c19fcf725a19cdf969b1c8095d36e44b5892be52e6")
        val sig = LiquidSigner.signDigest(privateKey, sighash)
        assertEquals(
            "304402206458657568c5d8685aa37eaa9de56421cac1caf2538fc5e7a14624930dd00372" +
                "02200c752ac042b29c62e273d2730fcfe6bbc91fe177c0c5d8b61121bdc9b6084aca" +
                "01",
            Hex.toHexString(sig),
        )
    }
}
