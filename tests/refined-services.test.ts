import { describe, it, expect } from 'vitest';
import { checkPolicyCompliance, DEFAULT_POLICIES } from '../services/smart-wallet';
import { getUnifiedBitcoinBalance } from '../services/protocol';
import { deriveSilentPaymentKeys, encodeSilentPaymentAddress } from '../services/silent-payments';
import { calculateEffectiveFeeRate } from '../services/monetization';
import { Buffer } from 'buffer';

describe('Sovereign Protocol Refinement', () => {

    it('validates smart wallet policies for velocity and decay', () => {
        const velocity = DEFAULT_POLICIES.find(p => p.type === 'VelocityLimit')!;
        expect(velocity.isActive).toBe(true);
        expect(checkPolicyCompliance([{ amount: 500000 }] as any, velocity)).toBe(true);
        expect(checkPolicyCompliance([{ amount: 1500000 }] as any, velocity)).toBe(false);
    });

    it('aggregates L1 and LN balances', () => {
        const assets: any[] = [
            { layer: 'Mainnet', balance: 100 },
            { layer: 'Lightning', balance: 50 }
        ];
        expect(getUnifiedBitcoinBalance(assets)).toBe(150);
    });

    it('derives BIP-352 keys correctly', () => {
        const seed = Buffer.alloc(64).fill(0x02);
        const keys = deriveSilentPaymentKeys(seed);
        const addr = encodeSilentPaymentAddress(keys.scanPub, keys.spendPub, 'testnet');
        expect(addr.startsWith('tsp1')).toBe(true);
    });

    it('calculates monetization fees with sovereignty discount', () => {
        const state: any = { version: '1.5.0', walletConfig: { backupVerified: true } };
        const rate = calculateEffectiveFeeRate(state);
        expect(rate).toBeLessThan(0.0025);
    });
});
