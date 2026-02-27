import { describe, it, expect } from 'vitest';
import { calculateEffectiveFeeRate, calculateNttIntegrationFee } from '../services/monetization';
import { AppState } from '../types';

describe('Monetization Logic', () => {
    const mockState: AppState = {
        isLocked: false,
        assets: [],
        sovereigntyScore: 1.0,
        loyaltyXP: 0.5,
        mode: 'Pro',
        lastAction: Date.now()
    };

    it('respects the floor fee of 0.1%', () => {
        const rate = calculateEffectiveFeeRate(mockState);
        expect(rate).toBeGreaterThanOrEqual(0.001);
    });

    it('should cap NTT integration fee at $50', () => {
        expect(calculateNttIntegrationFee(1000000)).toBe(50);
        expect(calculateNttIntegrationFee(1000)).toBe(1);
    });
});
