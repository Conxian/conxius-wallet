package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.conxius.wallet.bitcoin.SecureMnemonicGenerator
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.repository.WalletRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class OnboardingViewModel private constructor(
    private val hasPersistedWallet: suspend () -> Boolean,
    private val walletCreationService: WalletCreationService,
) : ViewModel() {

    constructor(
        repository: WalletRepository,
        strongBoxManager: StrongBoxManager,
    ) : this(
        hasPersistedWallet = { repository.getEncryptedSeed() != null },
        walletCreationService = WalletCreationService(
            generateMnemonic = { SecureMnemonicGenerator.generate() },
            encrypt = strongBoxManager::encrypt,
            persist = repository::saveSeed,
        ),
    )

    internal constructor(walletCreationService: WalletCreationService) : this(
        hasPersistedWallet = { false },
        walletCreationService = walletCreationService,
    )

    private val _isWalletCreated = MutableStateFlow(false)
    val isWalletCreated: StateFlow<Boolean> = _isWalletCreated

    private val _mnemonic = MutableStateFlow<String?>(null)
    val mnemonic: StateFlow<String?> = _mnemonic

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    init {
        viewModelScope.launch {
            if (hasPersistedWallet()) {
                _isWalletCreated.value = true
            }
        }
    }

    fun createWallet() {
        viewModelScope.launch {
            _error.value = null
            _mnemonic.value = null
            _isWalletCreated.value = false
            try {
                val generatedMnemonic = walletCreationService.create()
                _mnemonic.value = generatedMnemonic
                _isWalletCreated.value = true
            } catch (_: Exception) {
                _error.value = "Wallet creation failed: INTERNAL"
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
            } catch (_: Exception) {
                _error.value = "Wallet import failed: INTERNAL"
            }
        }
    }
}
