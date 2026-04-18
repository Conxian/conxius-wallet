package com.conxius.wallet.bitcoin

import android.util.Log

/**
 * EvmManager: Native Bridge for EVM-compatible Bitcoin L2s (BOB, Rootstock, B2).
 */
class EvmManager {
    private val TAG = "EvmManager"

    /**
     * Signs an EVM transaction (Legacy or EIP-1559).
     */
    fun signTransaction(data: ByteArray, chainId: Long): String {
        Log.d(TAG, "Signing EVM Transaction for Chain ID: $chainId")
        return ProductionRuntimeGuard.failClosed("EVM transaction signing")
    }

    /**
     * Signs an EIP-712 typed data message.
     */
    fun signTypedData(domainHash: ByteArray, messageHash: ByteArray): String {
        Log.d(TAG, "Signing EIP-712 Typed Data")
        return ProductionRuntimeGuard.failClosed("EIP-712 typed data signing")
    }
}
