package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.conxius.wallet.DeviceIntegrityPlugin
import com.conxius.wallet.PlayIntegrityPlugin
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.bitcoin.*
import com.conxius.wallet.crypto.StrongBoxManager
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
    private val breezManager: BreezManager
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
        viewModelScope.launch {
            try {
                val tx = babylonManager.createStakingTx("staker_pk", amount, 100, org.bitcoindevkit.Network.TESTNET)
                _error.value = "Staking Tx Created: $tx"
            } catch (e: Exception) {
                _error.value = "Staking failed: ${e.message}"
            }
        }
    }

    fun performArkLift(amount: Long) {
        viewModelScope.launch {
            try {
                val lift = arkManager.createLiftRequest(listOf("utxo1"), "asp_pk")
                _error.value = "Ark Lift Initiated: $lift"
            } catch (e: Exception) {
                _error.value = "Ark Lift failed: ${e.message}"
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

    fun deriveLiquidAddress() {
        viewModelScope.launch {
            try {
                val addr = liquidManager.deriveConfidentialAddress(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 6))
                _error.value = "Liquid Confidential Address: $addr"
            } catch (e: Exception) {
                _error.value = "Liquid address derivation failed: ${e.message}"
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

    fun connectLightningPeer(peerId: String) {
        viewModelScope.launch {
            try {
                val success = lightningManager.connectPeer(peerId, "localhost", 9735)
                if (success) _error.value = "Lightning Peer Connected: $peerId"
            } catch (e: Exception) {
                _error.value = "Lightning connection failed: ${e.message}"
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
