package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.bitcoin.BdkManager
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.crypto.EphemeralSeed
import com.conxius.wallet.database.AssetEntity
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

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

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun unlock(pin: String) {
        viewModelScope.launch {
            try {
                val encryptedSeed = repository.getEncryptedSeed() ?: throw Exception("No wallet found")
                val seedBytes = strongBoxManager.decrypt(encryptedSeed.encryptedSeed, encryptedSeed.iv)
                val mnemonicStr = String(seedBytes)

                bdkManager.initializeWallet(mnemonicStr)

                // Wipe seed from memory
                seedBytes.fill(0)

                _isLocked.value = false
            } catch (e: Exception) {
                _error.value = "Unlock failed: ${e.message}"
            }
        }
    }

    fun lock() {
        _isLocked.value = true
        // Additional cleanup here
    }

    fun refreshBalance() {
        viewModelScope.launch {
            // Logic to fetch from BDK and update database
            try {
                val address = bdkManager.getNewAddress()
                // In a real app, we would sync BDK wallet here
                // For now, let's just update the BTC asset with a mock balance if it's new
                val btcAsset = AssetEntity(
                    id = "BTC",
                    name = "Bitcoin",
                    symbol = "BTC",
                    balance = "0.00", // Mock for now
                    type = "L1",
                    updatedAt = System.currentTimeMillis()
                )
                repository.updateAssets(listOf(btcAsset))
            } catch (e: Exception) {
                _error.value = "Refresh failed: ${e.message}"
            }
        }
    }
}
