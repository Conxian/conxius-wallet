package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.conxius.wallet.repository.WalletRepository
import com.conxius.wallet.bitcoin.BdkManager
import com.conxius.wallet.crypto.StrongBoxManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class OnboardingViewModel(
    private val repository: WalletRepository,
    private val bdkManager: BdkManager,
    private val strongBoxManager: StrongBoxManager
) : ViewModel() {

    private val _isWalletCreated = MutableStateFlow(false)
    val isWalletCreated: StateFlow<Boolean> = _isWalletCreated

    private val _mnemonic = MutableStateFlow<String?>(null)
    val mnemonic: StateFlow<String?> = _mnemonic

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    init {
        viewModelScope.launch {
            if (repository.getEncryptedSeed() != null) {
                _isWalletCreated.value = true
            }
        }
    }

    fun createWallet() {
        viewModelScope.launch {
            try {
                // Simplified for simulation, in production use entropy
                val generatedMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
                _mnemonic.value = generatedMnemonic

                val seedBytes = generatedMnemonic.toByteArray()
                val (encrypted, iv) = strongBoxManager.encrypt(seedBytes)

                repository.saveSeed(encrypted, iv)
                _isWalletCreated.value = true
            } catch (e: Exception) {
                _error.value = "Wallet creation failed: ${e.message}"
            }
        }
    }

    fun importWallet(mnemonicStr: String) {
        viewModelScope.launch {
            try {
                val seedBytes = mnemonicStr.toByteArray()
                val (encrypted, iv) = strongBoxManager.encrypt(seedBytes)

                repository.saveSeed(encrypted, iv)
                _isWalletCreated.value = true
            } catch (e: Exception) {
                _error.value = "Wallet import failed: ${e.message}"
            }
        }
    }
}
