package com.conxius.wallet.bitcoin

import android.util.Log

/**
 * BreezManager: Native Bridge for Lightning Network operations via Breez SDK.
 */
class BreezManager {
    private val TAG = "BreezManager"

    /**
     * Starts the Breez node and returns the node ID.
     */
    fun startNode(apiKey: String, mnemonic: String): String {
        Log.d(TAG, "Starting Breez Lightning Node")
        return ProductionRuntimeGuard.failClosed(
            "Breez node startup",
            "breez_node_id_sim_${System.currentTimeMillis()}"
        )
    }

    /**
     * Pays a Lightning BOLT11 invoice.
     */
    fun payInvoice(bolt11: String): String {
        Log.d(TAG, "Paying Lightning Invoice: $bolt11")
        return ProductionRuntimeGuard.failClosed(
            "Breez invoice payment",
            "breez_preimage_sim_${System.currentTimeMillis()}"
        )
    }

    /**
     * Receives a payment via BOLT11.
     */
    fun receivePayment(amountSats: Long, description: String): String {
        return ProductionRuntimeGuard.failClosed(
            "Breez payment receive",
            "lnbc_invoice_sim_${System.currentTimeMillis()}"
        )
    }
}
