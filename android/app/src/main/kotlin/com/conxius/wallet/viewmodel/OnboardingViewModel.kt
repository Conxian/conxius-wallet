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
import org.bitcoindevkit.Mnemonic
import org.bitcoindevkit.WordCount

class OnboardingViewModel(
    private val repository: WalletRepository,
    private val bdkManager: BdkManager,
    private val strongBoxManager: StrongBoxManager
) : ViewModel() {

    private val _mnemonic = MutableStateFlow<String?>(null)
    val mnemonic: StateFlow<String?> = _mnemonic

    private val _isWalletCreated = MutableStateFlow(false)
    val isWalletCreated: StateFlow<Boolean> = _isWalletCreated

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun createNewWallet() {
        viewModelScope.launch {
            try {
                val newMnemonic = Mnemonic(WordCount.WORDS12)
                val mnemonicStr = newMnemonic.asString()
                _mnemonic.value = mnemonicStr

                withContext(Dispatchers.IO) {
                    bdkManager.initializeWallet(mnemonicStr)
                }

                // Encrypt and save (StrongBoxManager.encrypt will zero out the input)
                val mnemonicBytes = mnemonicStr.toByteArray()
                val (encrypted, iv) = strongBoxManager.encrypt(mnemonicBytes)
                repository.saveSeed(encrypted, iv)

                _isWalletCreated.value = true
            } catch (e: Exception) {
                _error.value = "Failed to create wallet: ${e.message}"
            }
        }
    }

    fun importWallet(mnemonicStr: String) {
        viewModelScope.launch {
            try {
                // Validate mnemonic
                Mnemonic.fromString(mnemonicStr)

                withContext(Dispatchers.IO) {
                    bdkManager.initializeWallet(mnemonicStr)
                }

                // Encrypt and save
                val mnemonicBytes = mnemonicStr.toByteArray()
                val (encrypted, iv) = strongBoxManager.encrypt(mnemonicBytes)
                repository.saveSeed(encrypted, iv)

                _isWalletCreated.value = true
            } catch (e: Exception) {
                _error.value = "Failed to import wallet: ${e.message}"
            }
        }
    }

    fun clearError() {
        _error.value = null
    }
}
