package com.conxius.wallet.bitcoin

import android.util.Log
import com.conxius.wallet.BuildConfig
import org.bitcoindevkit.*

/**
 * Discreet Log Contracts (DLC) Manager (v1.1)
 *
 * Provides native backing for DLC creation, acceptance, and settlement.
 * Current state:
 * - debug builds may exercise simulated flows for integration work
 * - release builds fail closed until real production-backed DLC execution is wired
 */
class DlcManager {
    private val TAG = "DlcManager"

    private fun ensureDebugSimulationAllowed() {
        if (!BuildConfig.DEBUG) {
            throw IllegalStateException(
                "Simulated DLC flow is disabled in release builds until production execution is implemented"
            )
        }
    }

    /**
     * Creates a DLC Offer message.
     */
    fun createOffer(oraclePk: String, eventDesc: String, collateral: Long): String {
        Log.d(TAG, "Creating DLC Offer for event: $eventDesc")
        ensureDebugSimulationAllowed()
        return "{\"id\": \"dlc_offer_${System.currentTimeMillis()}\", \"oracle\": \"$oraclePk\", \"collateral\": $collateral}"
    }

    /**
     * Accepts a DLC Offer.
     */
    fun acceptOffer(offerJson: String): String {
        Log.d(TAG, "Accepting DLC Offer")
        ensureDebugSimulationAllowed()
        return "{\"status\": \"accepted\", \"contractId\": \"dlc_con_sim_${System.currentTimeMillis()}\"}"
    }

    /**
     * Settles a DLC based on an oracle attestation.
     */
    fun settleDlc(contractId: String, oracleAttestation: String): String {
        Log.d(TAG, "Settling DLC $contractId with attestation")
        ensureDebugSimulationAllowed()
        return "dlc_settlement_sim_txid_" + System.currentTimeMillis()
    }

    /**
     * Estimates the funding fee for a DLC.
     */
    fun estimateFundingFee(collateral: Long): Long {
        return 1000L // 1000 sats fixed estimation
    }
}
