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

    fun markAuthenticated() {
        _isUnlocked.value = true
    }

    fun clearAuthentication() {
        _isUnlocked.value = false
        walletGeneration.incrementAndGet()
    }

    internal fun isGenerationActive(expectedGeneration: Long): Boolean =
        _isUnlocked.value && walletGeneration.get() == expectedGeneration

    internal fun requireGeneration(expectedGeneration: Long) {
        if (!isGenerationActive(expectedGeneration)) {
            throw NativeSilentPaymentException(NativeErrorCode.WALLET_LOCKED)
        }
    }

    internal suspend fun invalidateForWalletMutation() {
        mutationMutex.withLock {
            _isUnlocked.value = false
            walletGeneration.incrementAndGet()
        }
    }

    /**
     * Serializes a generation check with one Room persistence transaction. A wallet mutation takes
     * the same mutex before clearing/replacing the seed, so an old scan cannot commit after the
     * mutation becomes visible.
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
