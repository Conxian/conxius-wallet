package com.conxius.wallet.bitcoin

/**
* Centralized fail-closed runtime guard for production code paths that are
* intentionally unavailable until fully implemented.
*/
object ProductionRuntimeGuard {
    private const val STATUS_PREFIX = "503 SERVICE_UNAVAILABLE"

    fun message(operation: String): String {
        return "$STATUS_PREFIX: $operation is unavailable in production runtime"
    }

    fun failClosed(operation: String): Nothing {
        throw IllegalStateException(message(operation))
    }
}
