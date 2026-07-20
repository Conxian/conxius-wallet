package com.conxius.wallet.session

import com.conxius.wallet.bitcoin.NativeErrorCode
import com.conxius.wallet.bitcoin.NativeSilentPaymentException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.atomic.AtomicLong

/**
* Application-scoped, non-secret unlock state. It carries no PIN, seed, key, or authentication
* token; it only gates short-lived access to the StrongBox-backed seed callback.
*/
class WalletSession {
    private val _isUnlocked = MutableStateFlow(false)
    private val walletGeneration = AtomicLong(0L)
    private val mutationMutex = Mutex()

    val isUnlocked: StateFlow<Boolean> = _isUnlocked.asStateFlow()
    internal val generation: Long
        get() = walletGeneration.get()

    internal fun markAuthenticated() {
        _isUnlocked.value = true
    }

    internal suspend fun clearAuthentication() {
        invalidateAuthentication()
    }

    internal fun isGenerationActive(expectedGeneration: Long): Boolean =
        _isUnlocked.value && walletGeneration.get() == expectedGeneration

    internal fun requireGeneration(expectedGeneration: Long) {
        if (!isGenerationActive(expectedGeneration)) {
            throw NativeSilentPaymentException(NativeErrorCode.WALLET_LOCKED)
        }
    }

    internal suspend fun invalidateForWalletMutation() {
        invalidateAuthentication()
    }

    private suspend fun invalidateAuthentication() {
        mutationMutex.withLock {
            _isUnlocked.value = false
            walletGeneration.incrementAndGet()
        }
    }

    /**
     * Serializes a generation check with one Room persistence transaction. A wallet mutation takes
     * the same mutex to invalidate the session before its DAO operation, so an old scan cannot
     * commit after invalidation completes. A transaction already admitted through this gate is
     * allowed to finish; invalidation then establishes the happens-before boundary for later work.
     */
    internal suspend fun <T> withActiveGeneration(
        expectedGeneration: Long,
        block: suspend () -> T,
    ): T? {
        mutationMutex.lock()
        return try {
            if (!isGenerationActive(expectedGeneration)) null else block()
        } finally {
            mutationMutex.unlock()
        }
    }
}
