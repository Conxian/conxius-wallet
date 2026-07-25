import { describe, it, expect, vi } from 'vitest';
import { fetchYields, createYieldTransaction } from '../services/yield';

describe('Yield Service (Yield.xyz Integration)', () => {
    it('should fetch yield opportunities (Mocked)', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                yields: [
                    { yieldId: 'y1', protocol: 'Lido', asset: 'ETH', network: 'Ethereum', apy: 3.8, tvl: 32000000000, riskScore: 9.5 }
                ]
            })
        });

        const yields = await fetchYields(5);
        expect(yields.length).toBeGreaterThan(0);
        expect(yields[0]).toHaveProperty('protocol', 'Lido');
        expect(yields[0]).toHaveProperty('apy', 3.8);
    });

    it('quarantines yield transaction construction before provider I/O', async () => {
        const state: any = { rpcStrategy: 'Sovereign-First', version: '1.9.5' };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                transaction: { to: '0xYieldContractAddress', data: '0xData' }
            })
        });

        await expect(createYieldTransaction('y1', '1.0', state))
            .rejects.toThrow('YIELD_TRANSACTION_QUARANTINED');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
