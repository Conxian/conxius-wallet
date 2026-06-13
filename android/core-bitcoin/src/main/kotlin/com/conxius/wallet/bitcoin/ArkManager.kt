package com.conxius.wallet.bitcoin

import android.util.Log

/**
 * Ark V-UTXO Manager (v1.1)
 *
 * Handles native Ark lift and forfeit operations.
 * Aligned with v1.9.2 "Sovereign" architecture.
 */
class ArkManager {
    private val TAG = "ArkManager"

    fun createLiftRequest(amountSats: Long, cosignerPk: String): String {
        Log.d(TAG, "Creating Ark Lift Request for $amountSats sats")
        return ProductionRuntimeGuard.failClosed(
            "Ark lift request",
            "ark_lift_sim_txid_${System.currentTimeMillis()}"
        )
    }

    fun signForfeit(vutxoId: String): String {
        Log.d(TAG, "Signing Ark Forfeit for $vutxoId")
        return ProductionRuntimeGuard.failClosed(
            "Ark forfeit signing",
            "ark_forfeit_sim_sig_${System.currentTimeMillis()}"
        )
    }
}
