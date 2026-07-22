package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.conxius.wallet.DeviceIntegrityPlugin
import com.conxius.wallet.PlayIntegrityPlugin
import com.conxius.wallet.bitcoin.*
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.crypto.Web5Manager
import com.conxius.wallet.database.AssetEntity
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.scan.SilentPaymentScanCoordinator
import com.conxius.wallet.scan.SilentPaymentScanState
import com.conxius.wallet.session.WalletSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
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
    private val silentPaymentCoordinator: SilentPaymentScanCoordinator,
    private val walletSession: WalletSession,
    private val yieldManager: YieldManager,
    private val insuranceManager: InsuranceManager,
    private val interoperabilityManager: InteroperabilityManager,
    private val b2bManager: B2bManager
) : ViewModel() {

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

    val silentPaymentScanState: StateFlow<SilentPaymentScanState> = silentPaymentCoordinator.state

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
        viewModelScope.launch {
            if (_integrityResultSecure.value == false) {
                clearAuthenticationAndCancelScan()
                _isLocked.value = true
                _error.value = "Security Error: Device compromised"
                return@launch
            }
            clearAuthenticationAndCancelScan()
            _isLocked.value = true
            try {
                performUnlock()
            } catch (_: Exception) {
                clearAuthenticationAndCancelScan()
                _isLocked.value = true
                _error.value = "Unlock failed: INTERNAL"
            }
        }
    }

    private suspend fun performUnlock() {
        val encryptedSeed = repository.getEncryptedSeed() ?: throw Exception("No wallet found")
        val seedBytes = strongBoxManager.decrypt(encryptedSeed.encryptedSeed, encryptedSeed.iv)
        try {
            // BdkManager currently accepts String, so this is the one bounded unavoidable JVM
            // immutable copy. Native silent-payment scans use RoomWalletSeedProvider directly.
            val mnemonicStr = String(seedBytes, Charsets.UTF_8)
            withContext(Dispatchers.IO) {
                bdkManager.initializeWallet(mnemonicStr)
            }
        } finally {
            // Wipe the decrypted mutable source buffer even when BDK initialization fails.
            seedBytes.fill(0)
        }

        _isLocked.value = false
        walletSession.markAuthenticated()
        refreshBalance()
    }

    fun lock() {
        viewModelScope.launch {
            clearAuthenticationAndCancelScan()
            _isLocked.value = true
        }
    }

    private suspend fun clearAuthenticationAndCancelScan() {
        silentPaymentCoordinator.cancel()
        walletSession.clearAuthentication()
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
                    balance = String.format("%.8f", balance.toDouble() / 100_000_000.0),
                    type = "L1",
                    updatedAt = System.currentTimeMillis()
                )

                repository.updateAssets(listOf(btcAsset))
            } catch (_: Exception) {
                _error.value = "Refresh failed: INTERNAL"
            } finally {
                _isSyncing.value = false
            }
        }
    }

    // --- Bridged Protocol Actions ---

    fun scanSilentPayments(
        network: SilentPaymentNetwork,
        startHeight: Long? = null,
        endHeight: Long,
    ) {
        if (_isLocked.value || !walletSession.isUnlocked.value) {
            _error.value = "Silent payment scan failed: WALLET_LOCKED"
            return
        }
        viewModelScope.launch {
            try {
                silentPaymentCoordinator.start(
                    SilentPaymentScanOptions(
                        network = network,
                        startHeight = startHeight,
                        endHeight = endHeight,
                    ),
                ).await()
            } catch (e: CancellationException) {
                // Cancellation is represented by the structured StateFlow, not a raw message.
            } catch (e: NativeSilentPaymentException) {
                _error.value = "Silent payment scan failed: ${e.code.name}"
            } catch (_: Exception) {
                _error.value = "Silent payment scan failed: ${NativeErrorCode.INTERNAL.name}"
            }
        }
    }

    fun cancelSilentPaymentScan() {
        silentPaymentCoordinator.cancel()
    }

    fun unlockWithBiometrics() {
        unlock("")
    }

    fun createStakingTx(stakerPk: String, amount: Long) {
        viewModelScope.launch {
            try {
                val txid = babylonManager.createStakingTx(stakerPk, amount, 100, org.bitcoindevkit.Network.BITCOIN)
                _error.value = "Babylon Staking Signed: $txid"
            } catch (e: Exception) {
                _error.value = "Babylon failed: ${e.message}"
            }
        }
    }

    fun createDlcOffer(oraclePk: String, event: String, collateral: Long) {
        viewModelScope.launch {
            try {
                val offer = dlcManager.createOffer(oraclePk, event, collateral)
                _error.value = "DLC Offer Created: $offer"
            } catch (e: Exception) {
                _error.value = "DLC failed: ${e.message}"
            }
        }
    }

    fun parseNwcRequest(eventJson: String) {
        viewModelScope.launch {
            try {
                val parsed = nwcManager.parseEvent(eventJson)
                _error.value = "NWC Request Parsed: $parsed"
            } catch (e: Exception) {
                _error.value = "NWC failed: ${e.message}"
            }
        }
    }

    fun performArkLift(amount: Long, cosignerPk: String) {
        viewModelScope.launch {
            try {
                val txid = arkManager.createLiftRequest(amount, cosignerPk)
                _error.value = "Ark Lift Confirmed: $txid"
            } catch (e: Exception) {
                _error.value = "Ark failed: ${e.message}"
            }
        }
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
        viewModelScope.launch {
            try {
                val sig = mavenManager.signServiceRequest(payload)
                _error.value = "Maven Request Signed: $sig"
            } catch (e: Exception) {
                _error.value = "Maven failed: ${e.message}"
            }
        }
    }

    fun deriveLiquidAddress() {
        viewModelScope.launch {
            try {
                val address = liquidManager.deriveConfidentialAddress()
                _error.value = "Confidential Address: $address"
            } catch (e: Exception) {
                _error.value = "Liquid failed: ${e.message}"
            }
        }
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
            val outcome = bitVmManager.verifyProof(proof)
            _error.value = when (outcome) {
                is BitVmVerificationOutcome.Unsupported ->
                    "BitVM verification unavailable: ${outcome.reason}"
                is BitVmVerificationOutcome.Simulated ->
                    "BitVM simulation is non-authoritative: ${outcome.reason}"
                is BitVmVerificationOutcome.Malformed ->
                    "BitVM envelope malformed: ${outcome.reason}"
                is BitVmVerificationOutcome.Invalid ->
                    "BitVM verification rejected: ${outcome.reason}"
                is BitVmVerificationOutcome.Verified ->
                    "BitVM result is quarantined until the reviewed verifier and signing policy are enabled"
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
