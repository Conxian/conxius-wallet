package com.conxius.wallet.bitcoin

import com.conxius.wallet.crypto.EphemeralSeed
import org.bitcoindevkit.*

class BdkManager(private val network: Network = Network.TESTNET) {
    private var wallet: Wallet? = null
    private var externalDescriptor: Descriptor? = null
    private var internalDescriptor: Descriptor? = null

    fun initializeWallet(mnemonicStr: String, accountPath: String = "84'/1'/0'") {
        val mnemonic = Mnemonic.fromString(mnemonicStr)
        val rootKey = DescriptorSecretKey(network, mnemonic, null)

        val path = accountPath.trimStart('m').trimStart('/')

        // Support for both Segwit (84) and Taproot (86)
        val isTaproot = path.startsWith("86")
        val prefix = if (isTaproot) "tr" else "wpkh"

        val extDescStr = "${prefix}(${rootKey.asString()}/${path}/0/*)"
        val intDescStr = "${prefix}(${rootKey.asString()}/${path}/1/*)"

        try {
            externalDescriptor = Descriptor(extDescStr, network)
            internalDescriptor = Descriptor(intDescStr, network)

            wallet = Wallet(
                externalDescriptor!!,
                internalDescriptor,
                network,
                DatabaseConfig.Memory
            )
        } catch (e: Exception) {
            throw e
        }
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

    fun sync() {
        // Placeholder for blockchain client sync logic
        // In a real app, this would use an Electrum or Esplora client
    }

    fun getBalance(): ULong {
        return wallet?.getBalance()?.total ?: 0u
    }
}
