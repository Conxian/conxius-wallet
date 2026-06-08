import { describe, it, expect } from 'vitest';
import { TrustTier, BridgeSystem, validateRouteTrust, getSystemDefaultTier } from '../services/trust-policy';

describe('Trust Policy Engine', () => {
    describe('validateRouteTrust', () => {
        it('should allow IBC for T1', () => {
            const result = validateRouteTrust({
                system: BridgeSystem.IBC,
                sourceChain: 'Cosmos',
                targetChain: 'Stacks',
                trustTier: TrustTier.T1,
                isHardened: false
            });
            expect(result.allowed).toBe(true);
        });

        it('should reject non-IBC for T1', () => {
            const result = validateRouteTrust({
                system: BridgeSystem.WORMHOLE_NTT,
                sourceChain: 'Ethereum',
                targetChain: 'Base',
                trustTier: TrustTier.T1,
                isHardened: true
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('T1 (Sovereign) requires IBC');
        });

        it('should allow hardened Wormhole NTT for T2', () => {
            const result = validateRouteTrust({
                system: BridgeSystem.WORMHOLE_NTT,
                sourceChain: 'Ethereum',
                targetChain: 'Base',
                trustTier: TrustTier.T2,
                isHardened: true
            });
            expect(result.allowed).toBe(true);
        });

        it('should reject non-hardened Wormhole NTT for T2', () => {
            const result = validateRouteTrust({
                system: BridgeSystem.WORMHOLE_NTT,
                sourceChain: 'Ethereum',
                targetChain: 'Base',
                trustTier: TrustTier.T2,
                isHardened: false
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('T2 (Hybrid) requires hardened configuration');
        });

        it('should allow any for T3 (as caps are enforced elsewhere)', () => {
            const result = validateRouteTrust({
                system: BridgeSystem.AXELAR,
                sourceChain: 'Ethereum',
                targetChain: 'Stacks',
                trustTier: TrustTier.T3,
                isHardened: false
            });
            expect(result.allowed).toBe(true);
        });

        it('should reject T4 for production', () => {
            const result = validateRouteTrust({
                system: BridgeSystem.IBC,
                sourceChain: 'Testnet',
                targetChain: 'Testnet',
                trustTier: TrustTier.T4,
                isHardened: false
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('T4 (Observer/Weak) is forbidden');
        });
    });

    describe('getSystemDefaultTier', () => {
        it('should return T1 for IBC', () => {
            expect(getSystemDefaultTier(BridgeSystem.IBC)).toBe(TrustTier.T1);
        });

        it('should return T3 for Axelar', () => {
            expect(getSystemDefaultTier(BridgeSystem.AXELAR)).toBe(TrustTier.T3);
        });
    });
});
