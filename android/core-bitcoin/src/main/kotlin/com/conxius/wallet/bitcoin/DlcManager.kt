package com.conxius.wallet.bitcoin

/**
 * Discreet Log Contracts (DLC) Manager
 */
class DlcManager {
    fun createOffer(oraclePk: String, eventDesc: String, collateral: Long): String {
        return "dlc_offer_id_enclave_secured"
    }

    fun acceptOffer(offerJson: String): String {
        return "dlc_accept_msg_signed_by_strongbox"
    }

    fun settleDlc(contractId: String, oracleAttestation: String): String {
        return "cet_broadcast_txid_simulation"
    }
}
