import { describe, it, expect, vi } from 'vitest';
import { fetchBabylonStats, createBabylonStakeTransaction } from '../services/babylon';

describe('Babylon Staking Service', () => {
    it('should fetch Babylon stats', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network unavailable'));
        const stats = await fetchBabylonStats();
        expect(stats.totalStaked).toBeGreaterThan(0);
        expect(stats.apy).toBe(3.5);
        global.fetch = undefined as any;
    });

    it('quarantines Babylon stake transaction construction before provider I/O', async () => {
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

        await expect(createBabylonStakeTransaction(
            'tb1p...', '03...', 100000
        )).rejects.toThrow('BABYLON_STAKE_QUARANTINED');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
