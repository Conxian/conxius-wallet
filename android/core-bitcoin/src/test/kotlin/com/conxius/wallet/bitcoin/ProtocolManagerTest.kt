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
        val eventJson = """{"content":"pay_invoice"}"""
        val parsed = manager.parseRequest(eventJson, "secret_key")
        assertNotNull(parsed)
        assertEquals("pay_invoice", parsed)
    }

    @Test
    fun arkLiftConstruction() {
        val manager = ArkManager()
        val lift = manager.createLiftRequest(listOf("utxo1"), "asp_pk")
        assertNotNull(lift)
        assertTrue(lift.contains("ark_lift"))
    }

    @Test
    fun stateChainTransferSigning() {
        val manager = StateChainManager()
        val sig = manager.signTransfer("utxo1", "recipient_pk", 0)
        assertNotNull(sig)
        assertTrue(sig.contains("statechain"))
    }
}
