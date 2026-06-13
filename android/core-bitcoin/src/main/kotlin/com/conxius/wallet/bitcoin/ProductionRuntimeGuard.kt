package com.conxius.wallet.bitcoin

import com.conxius.wallet.BuildConfig

/**
 * Production Runtime Guard
 *
 * Enforces "Fail-Closed" behavior for sensitive protocol paths that are not
 * yet production-ready or require additional verification.
 */
object ProductionRuntimeGuard {

    /**
     * Fails closed in release builds, providing a simulation result in debug builds.
     *
     * @param feature Name of the feature/path being guarded.
     * @param simulationResult The mock result to return in debug builds.
     */
    fun <T> failClosed(feature: String, simulationResult: T): T {
        if (BuildConfig.DEBUG) {
            return simulationResult
        } else {
            throw UnsupportedOperationException(
                "Guard: Production path for '$feature' is not yet enabled. Fail-closed enforced."
            )
        }
    }
}
