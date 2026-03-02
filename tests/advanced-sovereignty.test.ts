import { describe, it, expect } from 'vitest';
import { checkPolicyCompliance, DEFAULT_POLICIES } from '../services/smart-wallet';
import { getUnifiedBitcoinBalance } from '../services/protocol';
import { deriveSilentPaymentKeys, encodeSilentPaymentAddress } from '../services/silent-payments';
import { Buffer } from 'buffer';

describe('Advanced Sovereignty Features', () => {

    describe('Smart Wallet Policies', () => {
        it('enforces Velocity Limits correctly', () => {
            const policy = DEFAULT_POLICIES.find(p => p.type === 'VelocityLimit')!;
            const highValueUtxos = [{ balance: 2000000, address: 'bc1...', status: 'confirmed', isFrozen: false } as any];
            const lowValueUtxos = [{ balance: 500000, address: 'bc1...', status: 'confirmed', isFrozen: false } as any];

            expect(checkPolicyCompliance(highValueUtxos, policy)).toBe(false);
            expect(checkPolicyCompliance(lowValueUtxos, policy)).toBe(true);
        });

        it('identifies Decaying Social Recovery rules', () => {
            const policy = DEFAULT_POLICIES.find(p => p.type === 'SocialRecovery')!;
            expect(policy.rules).toContain('older(25920)');
            expect(policy.rules).toContain('thresh(2');
        });
    });

    describe('Unified Balances', () => {
        it('aggregates L1 and Lightning balances into a single "Sats" view', () => {
            const mockAssets: any[] = [
                { layer: 'Mainnet', balance: 1000000 },
                { layer: 'Lightning', balance: 500000 },
                { layer: 'Stacks', balance: 2000000 }
            ];
            const unified = getUnifiedBitcoinBalance(mockAssets);
            expect(unified).toBe(1500000);
        });
    });

    describe('Silent Payments (BIP-352)', () => {
        it('derives consistent keys from a seed', () => {
            const seed = Buffer.alloc(64).fill(0x01);
            const keys = deriveSilentPaymentKeys(seed);
            expect(keys.scanPub.length).toBe(33);
            expect(keys.spendPub.length).toBe(33);

            const addr = encodeSilentPaymentAddress(keys.scanPub, keys.spendPub, 'mainnet');
            expect(addr.startsWith('sp1')).toBe(true);
        });
    });
});
