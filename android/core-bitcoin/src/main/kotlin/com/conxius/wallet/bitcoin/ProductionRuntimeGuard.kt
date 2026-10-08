package com.conxius.wallet.bitcoin

import com.conxius.wallet.bitcoin.BuildConfig

/**
 * Production Runtime Guard
 *
 * Enforces "Fail-Closed" behavior for sensitive protocol paths that are not
 * yet production-ready or require additional verification.
 */
object ProductionRuntimeGuard {

    /**
     * Whether [gate] is cleared for the production path.
     */
    fun isProductionEnabled(gate: FeatureGate): Boolean = gate.productionEnabled

    /**
     * Fails closed in release builds, providing a simulation result in debug builds.
     *
     * A production-enabled feature must have a real implementation wired in its
     * manager; routing one through this stub is a consistency bug and is rejected.
     *
     * @param gate The capability being guarded.
     * @param simulationResult The mock result to return in debug builds.
     */
    fun <T> failClosed(gate: FeatureGate, simulationResult: T): T {
        if (BuildConfig.DEBUG) {
            return simulationResult
        }
        if (gate.productionEnabled) {
            throw IllegalStateException(
                "Feature '${gate.name}' is production-enabled but routed through a fail-closed stub; wire its real implementation instead."
            )
        }
        throw UnsupportedOperationException(
            "Guard: Production path for '${gate.name}' is not yet enabled. Fail-closed enforced."
        )
    }
}
