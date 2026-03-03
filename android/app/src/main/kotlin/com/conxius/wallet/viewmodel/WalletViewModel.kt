package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.bitcoin.BdkManager
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.database.AssetEntity
import com.conxius.wallet.database.TransactionEntity
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class WalletViewModel(
    private val repository: WalletRepository,
    private val bdkManager: BdkManager,
    private val strongBoxManager: StrongBoxManager
) : ViewModel() {

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

    fun unlock(pin: String) {
        viewModelScope.launch {
            try {
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
            } catch (e: Exception) {
                _error.value = "Unlock failed: ${e.message}"
            }
        }
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

                // Discover other Bitcoin L2s or Protocols (Mock discovery for now)
                val liquidAsset = AssetEntity(
                    id = "LBTC",
                    name = "Liquid Bitcoin",
                    symbol = "L-BTC",
                    balance = "0.00",
                    type = "L2",
                    updatedAt = System.currentTimeMillis()
                )

                repository.updateAssets(listOf(btcAsset, liquidAsset))
            } catch (e: Exception) {
                _error.value = "Refresh failed: ${e.message}"
            } finally {
                _isSyncing.value = false
            }
        }
    }
}
