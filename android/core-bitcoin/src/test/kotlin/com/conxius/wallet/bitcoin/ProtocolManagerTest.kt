package com.conxius.wallet.bitcoin

import org.junit.Test
import org.junit.Assert.*
import org.bitcoindevkit.Network

class ProtocolManagerTest {
    @Test
    fun babylonStakingTxConstruction() {
        val manager = BabylonManager()
        val tx = manager.createStakingTx("test_pk", 100000L, 100, Network.TESTNET)
        assertNotNull(tx)
        assertTrue(tx.contains("babylon"))
    }

    @Test
    fun dlcOfferConstruction() {
        val manager = DlcManager()
        val offer = manager.createOffer("oracle_pk", "btc_price", 50000L)
        assertNotNull(offer)
        assertTrue(offer.contains("dlc_offer"))
    }

    @Test
    fun nwcRequestParsing() {
        val manager = NwcManager()
        // NwcManager now just gets the "content" field directly from JSON
        val eventJson = """{"content":"pay_invoice"}"""
        val parsed = manager.parseRequest(eventJson, "secret_key")
        assertNotNull(parsed)
        assertEquals("pay_invoice", parsed)
    }
}
