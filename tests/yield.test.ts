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

    it('should construct a yield transaction payload', async () => {
        const state: any = { rpcStrategy: 'Sovereign-First', version: '1.9.5' };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                transaction: { to: '0xYieldContractAddress', data: '0xData' }
            })
        });

        const result = await createYieldTransaction('y1', '1.0', state);
        expect(result).toMatchObject({
            kind: 'prepared',
            action: { transactionData: { to: '0xYieldContractAddress', data: '0xData' }, status: 'unsigned-provider-payload' },
        });
        expect(result.kind === 'prepared' && result.action.feeAmount).toBeGreaterThan(0);
    });

    it('never fabricates a yield transaction when provider status is ambiguous', async () => {
        const state: any = { rpcStrategy: 'Sovereign-First', version: '1.9.5' };
        global.fetch = vi.fn().mockRejectedValue(new Error('timeout'));
        const result = await createYieldTransaction('y1', '1.0', state);
        expect(result).toEqual({ kind: 'indeterminate', reason: 'provider_request_ambiguous' });
        expect(result).not.toHaveProperty('action');
    });
});
