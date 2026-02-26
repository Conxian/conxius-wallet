import { describe, it, expect } from 'vitest';
import { calculateEffectiveFeeRate, calculateNttFee } from '../services/monetization';
import { AppState } from '../types';

describe('Monetization Logic (SAF Model)', () => {
  it('respects the floor fee of 0.1% when score is 1.0 and loyalty is 0.5', () => {
    const perfectState: Partial<AppState> = {
        version: '1.5.0',
        walletConfig: { type: 'single', backupVerified: true, taprootAddress: 'bc1p...' },
        security: { autoLockMinutes: 10, biometricUnlock: true },
        lnBackend: { type: 'Breez', endpoint: '...' },
        utxos: [{ address: 'sp1...' } as any],
        isTorEnabled: true,
        activeCitadel: { id: 'test' } as any,
        assets: [{ layer: 'B2', symbol: 'BTC', balance: 1 } as any]
    };
    const rate = calculateEffectiveFeeRate(perfectState as AppState);
    expect(rate).toBeCloseTo(0.001, 5);
  });
});
