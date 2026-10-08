package com.conxius.wallet.bitcoin

/**
 * Authoritative per-feature production-enablement registry.
 *
 * Every protocol capability is recorded here with its production state:
 * ENABLED when its gate is satisfied and a real implementation is wired,
 * otherwise GATED (fail-closed in release builds by [ProductionRuntimeGuard]).
 *
 * This is the single source of truth for the production path, mirrored in
 * `.github-private/docs/CAPABILITY_GATES.json`. Enabling a capability is a
 * per-capability decision: satisfying one gate flips only that feature and
 * never blocks unrelated capabilities.
 */
enum class FeatureGate(val productionEnabled: Boolean) {
    // --- Production-enabled (real implementations, no fail-closed routing) ---
    BABYLON(true),
    BDK(true),
    EVM(true),
    LIQUID(true),
    MUSIG2(true),
    NWC(true),
    SILENT_PAYMENTS(true),
    STACKS(true),

    // --- Gated (fail-closed in production until each gate is satisfied) ---
    ARK(false),
    B2B(false),
    BITVM(false),
    BREEZ(false),
    DLC(false),
    INSURANCE(false),
    INTEROPERABILITY(false),
    LIGHTNING(false),
    MAVEN(false),
    NTT(false),
    RGB(false),
    STATE_CHAIN(false),
    YIELD(false),
    ;

    companion object {
        /** Features cleared for the production path. */
        fun productionEnabled(): Set<FeatureGate> =
            entries.filter { it.productionEnabled }.toSet()
    }
}
