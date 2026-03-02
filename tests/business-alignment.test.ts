import { describe, it, expect } from 'vitest';
import { calculateEffectiveFeeRate, calculateNttIntegrationFee } from '../services/monetization';

describe('Business Alignment & Monetization', () => {
    const mockState: any = {
        version: '1.5.0',
        walletConfig: { backupVerified: true },
        security: { biometricUnlock: true },
        lnBackend: { endpoint: 'http://localhost' },
        assets: [{ layer: 'Bitcoin L1', balance: 1000 }],
        isTorEnabled: true
    };

    it('calculates effective fee rate with loyalty discount', () => {
        const rate = calculateEffectiveFeeRate(mockState);
        // Base 0.25% * (1 - 0.5 loyalty) * (1 - sovereignty discount)
        // Score should be high (1.0 or close)
        expect(rate).toBeLessThan(0.0025);
        expect(rate).toBeGreaterThanOrEqual(0.001); // Floor
    });

    it('caps B2B NTT technical integration fee at $50', () => {
        expect(calculateNttIntegrationFee(1000000)).toBe(50);
        expect(calculateNttIntegrationFee(1000)).toBe(1);
    });
});
