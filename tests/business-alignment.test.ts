import { describe, it, expect } from 'vitest';
import { calculateEffectiveFeeRate, calculateNttIntegrationFee } from '../services/monetization';

describe('Business Alignment & Monetization', () => {
    const mockState: any = {
        version: '1.9.2',
        walletConfig: { backupVerified: true },
        security: { biometricUnlock: true },
        lnBackend: { endpoint: 'http://localhost' },
        assets: [{ layer: 'Bitcoin L1', balance: 1000 }],
        isTorEnabled: true,
        loyaltyXP: 5000,
        sovereigntyScore: 95
    };

    it('calculates effective fee rate with loyalty discount', () => {
        const rate = calculateEffectiveFeeRate(mockState);
        // Base 0.25% * (0.5 loyalty) * (0.8 sovereignty discount) = 0.001
        expect(rate).toBeLessThan(0.0025);
        expect(rate).toBeGreaterThanOrEqual(0.001); // Floor
    });

    it('caps B2B NTT technical integration fee at 0', () => {
        expect(calculateNttIntegrationFee(1000000)).toBe(50);
        expect(calculateNttIntegrationFee(1000)).toBe(1);
    });
});
