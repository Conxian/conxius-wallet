package com.conxius.wallet.bitcoin

import com.conxius.wallet.crypto.EphemeralSeed
import org.bitcoindevkit.*

class BdkManager(private val network: Network = Network.BITCOIN) {
    private var wallet: Wallet? = null
    private var persister: Persister? = null
    private var esploraClient: EsploraClient? = null
    private var externalDescriptor: Descriptor? = null
    private var internalDescriptor: Descriptor? = null

    private val descriptorNetworkKind: NetworkKind
        get() = if (network == Network.BITCOIN) NetworkKind.MAIN else NetworkKind.TEST

    private fun initializeDescriptors(
        descriptor: Descriptor,
        changeDescriptor: Descriptor?,
        proxyUrl: String?,
    ) {
        val newPersister = Persister.newInMemory()
        val newWallet = if (changeDescriptor == null) {
            Wallet.createSingle(descriptor, network, newPersister)
        } else {
            Wallet(descriptor, changeDescriptor, network, newPersister)
        }

        val url = if (network == Network.BITCOIN) {
            "https://blockstream.info/api"
        } else {
            "https://blockstream.info/testnet/api"
        }

        externalDescriptor = descriptor
        internalDescriptor = changeDescriptor
        persister = newPersister
        wallet = newWallet
        esploraClient = EsploraClient(url, proxyUrl)
    }

    fun initializeWallet(mnemonicStr: String, accountPath: String = "84'/0'/0'", proxyUrl: String? = null) {
        val mnemonic = Mnemonic.fromString(mnemonicStr)
        val rootKey = DescriptorSecretKey(descriptorNetworkKind, mnemonic, null)

        val path = accountPath.trimStart('m').trimStart('/')

        val isTaproot = path.startsWith("86")
        val prefix = if (isTaproot) "tr" else "wpkh"
        val key = rootKey.toString()

        val extDescStr = "${prefix}(${key}/${path}/0/*)"
        val intDescStr = "${prefix}(${key}/${path}/1/*)"

        try {
            val external = Descriptor(extDescStr, descriptorNetworkKind)
            val internal = Descriptor(intDescStr, descriptorNetworkKind)
            initializeDescriptors(external, internal, proxyUrl)
        } catch (e: Exception) {
            throw e
        }
    }

    fun initializeWithCustomDescriptor(descriptor: String, changeDescriptor: String?, proxyUrl: String? = null) {
        try {
            val external = Descriptor(descriptor, descriptorNetworkKind)
            val internal = changeDescriptor?.let { Descriptor(it, descriptorNetworkKind) }
            initializeDescriptors(external, internal, proxyUrl)
        } catch (e: Exception) {
            throw e
        }
    }

    fun signPsbt(ephemeralSeed: EphemeralSeed, psbtBase64: String): String {
        val currentWallet = wallet ?: throw IllegalStateException("Wallet not initialized")
        val psbt = Psbt(psbtBase64)

        return ephemeralSeed.use {
            val finalized = currentWallet.sign(
                psbt,
                SignOptions(
                    trustWitnessUtxo = false,
                    assumeHeight = null,
                    allowAllSighashes = false,
                    tryFinalize = true,
                    signWithTapInternalKey = true,
                    allowGrinding = true,
                ),
            )
            if (finalized) {
                psbt.serialize()
            } else {
                throw Exception("Failed to sign PSBT")
            }
        }
    }

    fun getNewAddress(): String {
        return wallet?.nextUnusedAddress(KeychainKind.EXTERNAL)?.address?.toString()
            ?: throw IllegalStateException("Wallet not initialized")
    }

    fun sync() {
        val currentWallet = wallet ?: throw IllegalStateException("Wallet not initialized")
        val currentPersister = persister ?: throw IllegalStateException("Wallet persistence not initialized")
        val currentEsploraClient = esploraClient ?: throw IllegalStateException("Esplora client not initialized")

        val request = currentWallet.startSyncWithRevealedSpks().build()
        val update = currentEsploraClient.sync(request, 1uL)
        currentWallet.applyUpdate(update)
        currentWallet.persist(currentPersister)
    }

    fun getBalance(): ULong {
        return wallet?.balance()?.total?.toSat() ?: 0uL
    }

    fun isInitialized(): Boolean = wallet != null
}
