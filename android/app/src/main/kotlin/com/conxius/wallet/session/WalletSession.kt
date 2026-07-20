package com.conxius.wallet.session

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
* Application-scoped, non-secret unlock state. It carries no PIN, seed, key, or authentication
* token; it only gates short-lived access to the StrongBox-backed seed callback.
*/
class WalletSession {
    private val _isUnlocked = MutableStateFlow(false)
    val isUnlocked: StateFlow<Boolean> = _isUnlocked.asStateFlow()

    fun markAuthenticated() {
        _isUnlocked.value = true
    }

    fun clearAuthentication() {
        _isUnlocked.value = false
    }
}
