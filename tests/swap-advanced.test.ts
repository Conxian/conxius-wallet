import { describe, it, expect, vi } from 'vitest';
import { createChangellyTransaction, executeBoltzSwap, executeGasSwap, fetchLifiQuote } from '../services/swap';

describe('Advanced Swap Service (LI.FI Integration)', () => {
    it('should fetch a LI.FI quote (Mocked)', async () => {
        const state: any = { rpcStrategy: 'Sovereign-First', version: '1.9.5' };
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

    it('quarantines Boltz execution instead of returning a synthetic transaction ID', async () => {
        await expect(executeBoltzSwap('lnbc1invoice', 'bc1qrefund', 'mainnet'))
            .rejects.toThrow('BOLTZ_SWAP_UNSUPPORTED');
    });

    it('quarantines gas swap execution instead of returning a synthetic transaction ID', async () => {
        await expect(executeGasSwap(1000, 'mainnet'))
            .rejects.toThrow('GAS_SWAP_UNSUPPORTED');
    });

    it('quarantines Changelly initiation before provider I/O', async () => {
        global.fetch = vi.fn();
        await expect(createChangellyTransaction({
            id: 'quote', fromAsset: 'BTC', toAsset: 'ETH', fromAmount: 1, toAmount: 10,
            fee: 0.01, effectiveFeeRate: 0.01, provider: 'Changelly', estimatedTime: 15,
        }, '0xrecipient', 'mainnet')).rejects.toThrow('CHANGELLY_SWAP_INITIATION_QUARANTINED');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
