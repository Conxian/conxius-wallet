import { describe, it, expect, vi } from 'vitest';
import { NttService, getRecommendedBridgeProtocol } from '../services/ntt';
import { TrustTier } from '../services/trust-policy';

describe('Trust Policy Integration', () => {
    describe('NttService.executeNtt', () => {
        it('should reject non-compliant T1 routes', async () => {
            const signer = { address: () => '0x123' } as any;
            await expect(NttService.executeNtt(
                '1.0',
                'Ethereum',
                'Base',
                signer,
                'mainnet',
                undefined,
                TrustTier.T1
            )).rejects.toThrow('Guard: T1 (Sovereign) requires IBC light-client paths');
        });

        it('should reject non-hardened T2 routes', async () => {
            const signer = { address: () => '0x123' } as any;
            await expect(NttService.executeNtt(
                '1.0',
                'Ethereum',
                'Base',
                signer,
                'mainnet',
                undefined,
                TrustTier.T2,
                false // not hardened
            )).rejects.toThrow('Guard: T2 (Hybrid) requires hardened configuration');
        });
    });

    describe('getRecommendedBridgeProtocol', () => {
        it('should return None if NTT does not meet required tier', () => {
            const protocol = getRecommendedBridgeProtocol('Ethereum', 'Base', TrustTier.T1);
            expect(protocol).toBe('None');
        });

        it('should return NTT if compliant with T3', () => {
            const protocol = getRecommendedBridgeProtocol('Ethereum', 'Base', TrustTier.T3);
            expect(protocol).toBe('NTT');
        });

        it('should return Native regardless of tier for Mainnet -> Stacks', () => {
            const protocol = getRecommendedBridgeProtocol('Mainnet', 'Stacks', TrustTier.T1);
            expect(protocol).toBe('Native');
        });
    });
});
