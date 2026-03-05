import { describe, it, expect, vi } from 'vitest';
import { fetchBabylonStats, createBabylonStakeTransaction } from '../services/babylon';

describe('Babylon Staking Service', () => {
    it('should fetch Babylon stats', async () => {
        const stats = await fetchBabylonStats();
        expect(stats.totalStaked).toBeGreaterThan(0);
        expect(stats.apy).toBe(3.5);
    });

    it('should construct a Babylon stake transaction payload (Mocked)', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                result: {
                    stakeTransactionHex: '0200000001...',
                    fee: 1000,
                    finallyProviderPublicKey: '02be...'
                }
            })
        });

        const result = await createBabylonStakeTransaction(
            'tb1p...', '03...', 100000
        );

        expect(result.unsignedTxHex).toBeDefined();
        expect(result.feeSats).toBe(1000);
    });
});
