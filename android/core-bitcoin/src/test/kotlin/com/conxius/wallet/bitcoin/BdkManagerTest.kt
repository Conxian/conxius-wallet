package com.conxius.wallet.bitcoin

import org.junit.Assert.assertNotNull
import org.junit.Test

class BdkManagerTest {
    @Test
    fun testWalletInitialization() {
        val manager = BdkManager()
        val mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        manager.initializeWallet(mnemonic)
        val address = manager.getNewAddress()
        assertNotNull(address)
    }
}
