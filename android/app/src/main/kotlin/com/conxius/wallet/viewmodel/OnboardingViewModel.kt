package com.conxius.wallet.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.conxius.wallet.bitcoin.SecureMnemonicGenerator
import com.conxius.wallet.crypto.StrongBoxManager
import com.conxius.wallet.repository.WalletRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class OnboardingViewModel private constructor(
    private val hasPersistedWallet: suspend () -> Boolean,
    private val walletCreationService: WalletCreationService,
    private val operationScope: CoroutineScope?,
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
        operationScope = null,
    )

    internal constructor(
        walletCreationService: WalletCreationService,
        hasPersistedWallet: suspend () -> Boolean = { false },
        operationScope: CoroutineScope? = null,
    ) : this(
        hasPersistedWallet = hasPersistedWallet,
        walletCreationService = walletCreationService,
        operationScope = operationScope,
    )

    private val walletCreationCoordinator = WalletCreationCoordinator(
        hasPersistedWallet = hasPersistedWallet,
        create = walletCreationService::create,
    )

    private val scope: CoroutineScope
        get() = operationScope ?: viewModelScope

    private val _isWalletCreated = MutableStateFlow(false)
    val isWalletCreated: StateFlow<Boolean> = _isWalletCreated

    private val _mnemonic = MutableStateFlow<String?>(null)
    val mnemonic: StateFlow<String?> = _mnemonic

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    val isCreatingWallet: StateFlow<Boolean> = walletCreationCoordinator.isInProgress

    init {
        scope.launch {
            if (hasPersistedWallet()) {
                _isWalletCreated.value = true
            }
        }
    }

    fun createWallet() {
        if (_isWalletCreated.value || isCreatingWallet.value) {
            return
        }

        scope.launch {
            _error.value = null
            try {
                when (val attempt = walletCreationCoordinator.createIfAllowed()) {
                    is WalletCreationAttempt.Created -> {
                        _mnemonic.value = attempt.mnemonic
                        _isWalletCreated.value = true
                    }

                    WalletCreationAttempt.ExistingWallet -> {
                        _isWalletCreated.value = true
                    }

                    WalletCreationAttempt.Rejected -> Unit
                }
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                _mnemonic.value = null
                _isWalletCreated.value = false
                _error.value = "Wallet creation failed: INTERNAL"
            }
        }
    }

    fun importWallet(mnemonicStr: String) {
        if (_isWalletCreated.value || isCreatingWallet.value) {
            return
        }

        scope.launch {
            try {
                walletCreationService.persistMnemonic(mnemonicStr)
                _isWalletCreated.value = true
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                _error.value = "Wallet import failed: INTERNAL"
            }
        }
    }
}
