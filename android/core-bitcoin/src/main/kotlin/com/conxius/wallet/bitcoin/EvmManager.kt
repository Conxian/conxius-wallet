package com.conxius.wallet.bitcoin

/**
 * EVM Manager
 * Handles signing and coordination for Bitcoin EVM L2s (BOB, RSK, B2, etc.)
 */
class EvmManager {

    /**
     * Signs an EVM transaction using the enclave.
     */
    fun signTransaction(txData: ByteArray, chainId: Long): String {
        return "evm_signed_tx_enclave_placeholder"
    }

    /**
     * Signs a typed data message (EIP-712).
     */
    fun signTypedData(domainHash: ByteArray, messageHash: ByteArray): String {
        return "evm_signed_typed_data_enclave_placeholder"
    }
}
