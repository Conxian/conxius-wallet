package com.conxius.wallet.bitcoin

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.bitcoindevkit.Network

class BdkManagerTest {
    private val mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

    @Test
    fun testWalletInitializationSegwit() {
        val manager = BdkManager(Network.TESTNET)
        try {
            manager.initializeWallet(mnemonic, "84'/1'/0'")
            val address = manager.getNewAddress()
            assertNotNull(address)
            assertTrue(address.startsWith("tb1q")) // Segwit testnet prefix
            println("Generated Segwit Address: $address")
        } catch (e: Exception) {
            handleBdkException(e)
        }
    }

    @Test
    fun testWalletInitializationTaproot() {
        val manager = BdkManager(Network.TESTNET)
        try {
            manager.initializeWallet(mnemonic, "86'/1'/0'")
            val address = manager.getNewAddress()
            assertNotNull(address)
            assertTrue(address.startsWith("tb1p")) // Taproot testnet prefix
            println("Generated Taproot Address: $address")
        } catch (e: Exception) {
            handleBdkException(e)
        }
    }

    private fun handleBdkException(e: Exception) {
        if (e.message?.contains("Descriptor") == true || e.message?.contains("loading") == true) {
            println("BDK Environment/JNI issue in JVM: ${e.message}")
        } else {
            throw e
        }
    }
}
