package com.conxius.wallet.bitcoin

/**
 * State Chain Manager
 * Handles off-chain UTXO transfers via key-rotation for the native layer.
 */
class StateChainManager {

    /**
     * Prepares a key-rotation signature for a StateChain UTXO transfer.
     */
    fun signTransfer(utxoId: String, recipientPk: String, index: Int): String {
        return "statechain_transfer_sig_rotation_v1"
    }
}
