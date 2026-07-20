package com.conxius.wallet.viewmodel

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

internal sealed interface WalletCreationAttempt {
    data class Created(val mnemonic: String) : WalletCreationAttempt

    data object ExistingWallet : WalletCreationAttempt

    data object Rejected : WalletCreationAttempt
}

/**
* Ensures wallet creation is single-flight and checks for an existing persisted wallet before
* generating a replacement. A rejected call returns immediately instead of waiting behind the
* active creation.
*/
internal class WalletCreationCoordinator(
    private val hasPersistedWallet: suspend () -> Boolean,
    private val create: suspend () -> String,
) {
    private val lock = Any()
    private var inProgress = false
    private val _isInProgress = MutableStateFlow(false)
    val isInProgress: StateFlow<Boolean> = _isInProgress.asStateFlow()

    suspend fun createIfAllowed(): WalletCreationAttempt {
        if (!tryAcquire()) {
            return WalletCreationAttempt.Rejected
        }

        return try {
            if (hasPersistedWallet()) {
                WalletCreationAttempt.ExistingWallet
            } else {
                WalletCreationAttempt.Created(create())
            }
        } finally {
            release()
        }
    }

    private fun tryAcquire(): Boolean = synchronized(lock) {
        if (inProgress) {
            false
        } else {
            inProgress = true
            _isInProgress.value = true
            true
        }
    }

    private fun release() {
        synchronized(lock) {
            inProgress = false
            _isInProgress.value = false
        }
    }
}
