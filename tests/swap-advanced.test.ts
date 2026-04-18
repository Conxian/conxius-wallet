import { describe, it, expect, vi } from 'vitest';
import { fetchLifiQuote } from '../services/swap';

describe('Advanced Swap Service (LI.FI Integration)', () => {
    it('should fetch a LI.FI quote (Mocked)', async () => {
        const state: any = { rpcStrategy: 'Sovereign-First', version: '1.9.2' };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                transactionId: 'test-tx-id',
                estimate: {
                    toAmount: '95000000000000000',
                    executionDuration: 300,
                    gasCosts: [{ amount: '1000000000000000' }]
                },
                transactionRequest: { to: '0xAddress', data: '0xData' }
            })
        });

        const quote = await fetchLifiQuote(
            1, 42161, 'USDC', 'USDC', '100000000000000000', '0xUser', state
        );

        expect(quote.provider).toBe('LI.FI');
        expect(quote.toAmount).toBe(0.095);
        expect(quote.transactionRequest).toBeDefined();
    });
});
