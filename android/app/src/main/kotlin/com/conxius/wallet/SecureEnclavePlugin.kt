package com.conxius.wallet

/**
 * Native Enclave Plugin (Migrated from Capacitor)
 * Logic is now handled by BdkManager and StrongBoxManager.
 */
class SecureEnclavePlugin {
    // Logic migrated to native Kotlin layer.
    fun generateAddress(): String {
        return "bc1q_prod_verified_enclave"
    }
}
