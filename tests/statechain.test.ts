import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transferStateChainUtxo, withdrawStateChainUtxo } from '../services/statechain';

// Mock dependencies
vi.mock('../services/notifications', () => ({
    notificationService: {
        notify: vi.fn()
    }
}));

vi.mock('../services/signer', () => ({
    requestEnclaveSignature: vi.fn().mockResolvedValue({
        signature: 'mock_schnorr_signature_hex',
        pubkey: 'mock_pubkey',
        timestamp: Date.now()
    })
}));

vi.mock('../services/network', () => ({
    endpointsFor: () => ({ STATE_CHAIN_API: 'https://mock.statechains.api' }),
    fetchWithRetry: async (url: string, options: any) => global.fetch(url, options)
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('StateChain Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    it('should transfer a StateChain UTXO using Enclave', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ txid: 'statechain_txid_123' })
        });

        const result = await transferStateChainUtxo(
            'sc:utxo-1', 
            '03newowner',
            0,
            'mock-vault-data'
        );
        
        expect(result.nextIndex).toBe(1);
        expect(result.signature).toBe('mock_schnorr_signature_hex');
        expect(result.txid).toBe('statechain_txid_123');
    });

    it('should withdraw a StateChain UTXO to L1', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ txid: 'withdrawal_txid_456' })
        });

        const txid = await withdrawStateChainUtxo(
            'sc:utxo-1',
            'bc1q_dest',
            'mock-vault-data'
        );

        expect(txid).toBeDefined();
        expect(txid).toContain('txid_withdrawal_');
    });
});
