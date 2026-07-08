/**
 * Conxius Bridge & Messaging Trust Policy Engine
 * Enforces approved trust-tier constraints for cross-chain operations.
 * Aligned with v1.9.5 Sovereign Architecture.
 */

export enum TrustTier {
    T1 = 'T1', // Sovereign Verified
    T2 = 'T2', // Hybrid Verified
    T3 = 'T3', // Attester Network
    T4 = 'T4', // Observer/Weak (Sandbox only)
}

export enum BridgeSystem {
    IBC = 'ibc',
    WORMHOLE_NTT = 'wormhole_ntt',
    HYPERLANE = 'hyperlane',
    LAYERZERO_V2 = 'layerzero_v2',
    AXELAR = 'axelar',
}

export interface RoutePolicy {
    system: BridgeSystem;
    sourceChain: string;
    targetChain: string;
    trustTier: TrustTier;
    isHardened: boolean;
}

/**
 * Validates whether a specific route meets the required trust tier.
 * Implements "Fail-Closed" behavior for non-compliant configurations.
 */
export function validateRouteTrust(policy: RoutePolicy): { allowed: boolean; reason?: string } {
    const { system, trustTier, isHardened } = policy;

    // T4 is forbidden in production
    if (trustTier === TrustTier.T4) {
        return { allowed: false, reason: 'T4 (Observer/Weak) is forbidden in production.' };
    }

    // T1 Requirements: IBC light-client only
    if (trustTier === TrustTier.T1) {
        if (system !== BridgeSystem.IBC) {
            return { allowed: false, reason: `T1 (Sovereign) requires IBC light-client paths. System ${system} is not allowed.` };
        }
        return { allowed: true };
    }

    // T2 Requirements: Hardened config for non-IBC systems
    if (trustTier === TrustTier.T2) {
        if (system === BridgeSystem.IBC) return { allowed: true };

        if (!isHardened) {
            return { allowed: false, reason: `T2 (Hybrid) requires hardened configuration for ${system}.` };
        }

        // Wormhole NTT is T3 by default, T2 only with independent verifiers (hardened)
        // Hyperlane/LayerZero v2 are T2/T3 depending on config
        return { allowed: true };
    }

    // T3 Requirements: Attester networks with caps (caps enforced by Gateway)
    if (trustTier === TrustTier.T3) {
        return { allowed: true };
    }

    return { allowed: false, reason: 'Unknown trust tier or system configuration.' };
}

/**
 * Returns the maximum allowed trust tier for a system based on default architecture.
 */
export function getSystemDefaultTier(system: BridgeSystem): TrustTier {
    switch (system) {
        case BridgeSystem.IBC: return TrustTier.T1;
        case BridgeSystem.HYPERLANE:
        case BridgeSystem.LAYERZERO_V2: return TrustTier.T2;
        case BridgeSystem.WORMHOLE_NTT:
        case BridgeSystem.AXELAR: return TrustTier.T3;
        default: return TrustTier.T4;
    }
}
