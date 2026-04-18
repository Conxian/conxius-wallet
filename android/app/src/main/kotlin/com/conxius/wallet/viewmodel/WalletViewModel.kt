package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.conxius.wallet.DeviceIntegrityPlugin
import com.conxius.wallet.PlayIntegrityPlugin
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.bitcoin.*
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.crypto.Web5Manager
import com.conxius.wallet.database.AssetEntity
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class WalletViewModel(
    private val repository: WalletRepository,
    private val bdkManager: BdkManager,
    private val strongBoxManager: StrongBoxManager,
    private val babylonManager: BabylonManager,
    private val dlcManager: DlcManager,
    private val nwcManager: NwcManager,
    private val arkManager: ArkManager,
    private val stateChainManager: StateChainManager,
    private val mavenManager: MavenManager,
    private val liquidManager: LiquidManager,
    private val evmManager: EvmManager,
    private val lightningManager: LightningManager,
    private val breezManager: BreezManager,
    private val stacksManager: StacksManager,
    private val rgbManager: RgbManager,
    private val bitVmManager: BitVmManager,
    private val web5Manager: Web5Manager,
    private val musig2Manager: Musig2Manager,
    private val silentPaymentManager: SilentPaymentManager,
    private val yieldManager: YieldManager,
    private val insuranceManager: InsuranceManager,
    private val interoperabilityManager: InteroperabilityManager,
    private val b2bManager: B2bManager
) : ViewModel() {

    private fun failClosed(operation: String) {
        _error.value = ProductionRuntimeGuard.message(operation)
    }

    private val integrityPlugin = DeviceIntegrityPlugin()
    private val playIntegrityPlugin = PlayIntegrityPlugin()

    val assets: StateFlow<List<AssetEntity>> = repository.allAssets
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val transactions = repository.allTransactions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isLocked = MutableStateFlow(true)
    val isLocked: StateFlow<Boolean> = _isLocked

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _integrityResultSecure = MutableStateFlow<Boolean?>(null)
    val integrityResultSecure: StateFlow<Boolean?> = _integrityResultSecure

    fun checkIntegrity() {
        val result = integrityPlugin.checkIntegrity()
        _integrityResultSecure.value = result
    }

    fun requestPlayIntegrityToken(nonce: String): String {
        return playIntegrityPlugin.requestIntegrityToken(nonce)
    }

    fun unlock(pin: String) {
        if (_integrityResultSecure.value == false) {
            _error.value = "Security Error: Device compromised"
            return
        }
        viewModelScope.launch {
            try {
                performUnlock()
            } catch (e: Exception) {
                _error.value = "Unlock failed: ${e.message}"
            }
        }
    }

    private suspend fun performUnlock() {
        val encryptedSeed = repository.getEncryptedSeed() ?: throw Exception("No wallet found")
        val seedBytes = strongBoxManager.decrypt(encryptedSeed.encryptedSeed, encryptedSeed.iv)
        val mnemonicStr = String(seedBytes)

        withContext(Dispatchers.IO) {
            bdkManager.initializeWallet(mnemonicStr)
        }

        // Wipe seed from memory
        seedBytes.fill(0)

        _isLocked.value = false
        refreshBalance()
    }

    fun lock() {
        _isLocked.value = true
    }

    fun refreshBalance() {
        if (_isSyncing.value) return

        viewModelScope.launch {
            _isSyncing.value = true
            try {
                withContext(Dispatchers.IO) {
                    bdkManager.sync()
                }

                val balance = bdkManager.getBalance()
                val btcAsset = AssetEntity(
                    id = "BTC",
                    name = "Bitcoin",
                    symbol = "BTC",
                    balance = (balance.toDouble() / 100_000_000.0).toString(),
                    type = "L1",
                    updatedAt = System.currentTimeMillis()
                )

                repository.updateAssets(listOf(btcAsset))
            } catch (e: Exception) {
                _error.value = "Refresh failed: ${e.message}"
            } finally {
                _isSyncing.value = false
            }
        }
    }

    // --- Bridged Protocol Actions ---

    fun createStakingTx(amount: Long) {
        failClosed("Babylon staking transaction creation")
    }

    fun createDlcOffer(collateral: Long) {
        failClosed("DLC offer creation")
    }

    fun parseNwcRequest(eventJson: String) {
        failClosed("NWC request parsing")
    }

    fun performArkLift(amount: Long) {
        failClosed("Ark lift request creation")
    }

    fun transferStateChain(utxoId: String, recipientPk: String) {
        viewModelScope.launch {
            try {
                val sig = stateChainManager.signTransfer(utxoId, recipientPk, 0)
                _error.value = "StateChain Transfer Signed: $sig"
            } catch (e: Exception) {
                _error.value = "StateChain failed: ${e.message}"
            }
        }
    }

    fun signMavenRequest(payload: String) {
        failClosed("Maven service request signing")
    }

    fun deriveLiquidAddress() {
        failClosed("Liquid confidential address derivation")
    }

    fun signEvmTransaction(data: ByteArray) {
        viewModelScope.launch {
            try {
                val sig = evmManager.signTransaction(data, 1)
                _error.value = "EVM Transaction Signed: $sig"
            } catch (e: Exception) {
                _error.value = "EVM signing failed: ${e.message}"
            }
        }
    }

    fun signStacksTx(payload: ByteArray) {
        viewModelScope.launch {
            try {
                val sig = stacksManager.signStacksTransaction(payload)
                _error.value = "Stacks Tx Signed: $sig"
            } catch (e: Exception) {
                _error.value = "Stacks signing failed: ${e.message}"
            }
        }
    }

    fun validateRgbConsignment(consignment: String) {
        viewModelScope.launch {
            try {
                val valid = rgbManager.validateConsignment(consignment)
                _error.value = "RGB Consignment Valid: $valid"
            } catch (e: Exception) {
                _error.value = "RGB validation failed: ${e.message}"
            }
        }
    }

    fun verifyBitVmProof(proof: String) {
        viewModelScope.launch {
            try {
                val valid = bitVmManager.verifyProof(proof)
                _error.value = "BitVM Proof Valid: $valid"
            } catch (e: Exception) {
                _error.value = "BitVM verification failed: ${e.message}"
            }
        }
    }

    fun signWeb5Message(hash: ByteArray) {
        viewModelScope.launch {
            try {
                val sig = web5Manager.signDwnMessage(hash)
                _error.value = "Web5 Message Signed: $sig"
            } catch (e: Exception) {
                _error.value = "Web5 signing failed: ${e.message}"
            }
        }
    }

    fun signYieldTx(payload: ByteArray) {
        viewModelScope.launch {
            try {
                val sig = yieldManager.signYieldTx(payload)
                _error.value = "Yield Tx Signed: $sig"
            } catch (e: Exception) {
                _error.value = "Yield signing failed: ${e.message}"
            }
        }
    }

    fun signInsurancePurchase(policyId: String, amount: Long) {
        viewModelScope.launch {
            try {
                val sig = insuranceManager.signCoverPurchase(policyId, amount)
                _error.value = "Insurance Cover Purchased: $sig"
            } catch (e: Exception) {
                _error.value = "Insurance failed: ${e.message}"
            }
        }
    }

    fun signSwap(payload: ByteArray) {
        viewModelScope.launch {
            try {
                val sig = interoperabilityManager.signSwap(payload)
                _error.value = "Swap Signed: $sig"
            } catch (e: Exception) {
                _error.value = "Swap signing failed: ${e.message}"
            }
        }
    }

    fun signB2bInvoice(id: String, amount: Long) {
        viewModelScope.launch {
            try {
                val sig = b2bManager.signInvoice(id, amount)
                _error.value = "B2B Invoice Signed: $sig"
            } catch (e: Exception) {
                _error.value = "B2B signing failed: ${e.message}"
            }
        }
    }

    fun startBreezNode(apiKey: String, mnemonic: String) {
        viewModelScope.launch {
            try {
                val id = breezManager.startNode(apiKey, mnemonic)
                _error.value = "Breez Node Started: $id"
            } catch (e: Exception) {
                _error.value = "Breez start failed: ${e.message}"
            }
        }
    }
}
