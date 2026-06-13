package com.conxius.wallet.bitcoin

import android.util.Log

/**
 * EvmManager: Native Bridge for EVM-compatible Bitcoin L2s (BOB, Rootstock).
 */
class EvmManager {
    private val TAG = "EvmManager"

    /**
     * Signs an EVM transaction (Legacy, EIP-1559, or EIP-2930).
     */
    fun signTransaction(txPayload: ByteArray, chainId: Long): String {
        Log.d(TAG, "Signing EVM Transaction for chain: $chainId")
        return ProductionRuntimeGuard.failClosed(
            "EVM transaction signing",
            "evm_sig_hex_00112233"
        )
    }

    /**
     * Signs EIP-712 typed data for secure contract interaction.
     */
    fun signTypedData(jsonPayload: String): String {
        Log.d(TAG, "Signing EIP-712 Typed Data")
        return ProductionRuntimeGuard.failClosed(
            "EIP-712 typed data signing",
            "evm_typed_sig_hex"
        )
    }
}
