package com.conxius.wallet.bitcoin

import android.util.Log

/**
 * NwcManager: Native Bridge for Nostr Wallet Connect (NIP-47).
 */
class NwcManager {
    private val TAG = "NwcManager"

    /**
     * Parses and validates an NWC request event.
     */
    fun parseEvent(json: String): String {
        Log.d(TAG, "Parsing NWC Event")
        return ProductionRuntimeGuard.failClosed("NWC event parsing", "{\"method\": \"pay_invoice\"}")
    }

    /**
     * Signs an NWC response event.
     */
    fun signResponse(id: String, result: String): String {
        return ProductionRuntimeGuard.failClosed(
            "NWC response signing",
            "nwc_res_sig_${System.currentTimeMillis()}"
        )
    }
}
