package com.conxius.wallet.bitcoin

import org.junit.Test
import org.junit.Assert.*

class ProtocolManagerTest {
    @Test
    fun dlcOfferConstruction() {
        val manager = DlcManager()
        val offer = manager.createOffer("oracle_pk", "btc_price", 50000L)
        assertNotNull(offer)
        assertTrue(offer.contains("dlc_offer"))
    }

    @Test
    fun stateChainTransferSigning() {
        val manager = StateChainManager()
        val sig = manager.signTransfer("utxo1", "recipient_pk", 0)
        assertNotNull(sig)
        assertTrue(sig.contains("statechain"))
    }
}
