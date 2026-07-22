package com.conxius.wallet.bitcoin

import android.util.Log

/**
 * Ark V-UTXO Manager (v1.2)
 *
* Handles the native Ark boundary while the reviewed protocol implementation
* remains unavailable. No debug or release path returns synthetic protocol
* identifiers, signatures, or PSBTs.
 */
class ArkManager {
    private val TAG = "ArkManager"

    /** The reviewed Ark V-UTXO derivation backend is not integrated. */
    fun deriveVutxoIndex(seed: ByteArray, path: String, index: Int): ByteArray {
        Log.d(TAG, "Deriving V-UTXO index for $path/$index using PRF")
        throw UnsupportedOperationException(
            "Ark V-UTXO derivation is unavailable until the reviewed native backend exists",
        )
    }

    /**
     * Signs a forfeit transaction for a specific V-UTXO.
     * Must be routed through the Secure Enclave with Schnorr signatures.
     */
    fun signForfeit(vutxoId: String, amountSats: Long): String {
        Log.d(TAG, "Signing Ark Forfeit for $vutxoId ($amountSats sats)")

        throw UnsupportedOperationException(
            "Ark forfeit signing is unavailable until the reviewed native backend exists",
        )
    }

    /**
     * Generates an Ark Boarding PSBT request.
     */
    fun createLiftRequest(amountSats: Long, cosignerPk: String): String {
        Log.d(TAG, "Creating Ark Lift Request for $amountSats sats")
        throw UnsupportedOperationException(
            "Ark lift requests are unavailable until the reviewed native backend exists",
        )
    }
}
