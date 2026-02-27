package com.conxius.wallet.bitcoin

import com.conxius.wallet.crypto.EphemeralSeed
import org.bitcoindevkit.*

class BdkManager(private val network: Network = Network.TESTNET) {
    private var wallet: Wallet? = null

    fun initializeWallet(mnemonicStr: String, path: String = "m/84'/1'/0'/0/0") {
        val mnemonic = Mnemonic.fromString(mnemonicStr)
        val descriptorSecretKey = DescriptorSecretKey(network, mnemonic, null)
        val externalDescriptorStr = "wpkh(${descriptorSecretKey.asString()}/${path})"
        val externalDescriptor = Descriptor(externalDescriptorStr, network)

        wallet = Wallet(
            externalDescriptor,
            null,
            network,
            DatabaseConfig.Memory
        )
    }

    fun signPsbt(ephemeralSeed: EphemeralSeed, psbtBase64: String): String {
        val currentWallet = wallet ?: throw IllegalStateException("Wallet not initialized")
        val psbt = PartiallySignedTransaction(psbtBase64)

        return ephemeralSeed.use {
            val finalized = currentWallet.sign(psbt, null)
            if (finalized) {
                psbt.serialize()
            } else {
                throw Exception("Failed to sign PSBT")
            }
        }
    }

    fun getNewAddress(): String {
        return wallet?.getAddress(AddressIndex.New)?.address?.asString()
            ?: throw IllegalStateException("Wallet not initialized")
    }
}
