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

    it('quarantines transfer before coordinator broadcast without authoritative evidence', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ txid: 'statechain_txid_123' })
        });

        await expect(transferStateChainUtxo(
            'sc:utxo-1', 
            '03newowner',
            0,
            'mock-vault-data'
        )).rejects.toThrow('MISSING_AUTHORITATIVE_EVIDENCE');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('quarantines withdrawal instead of fabricating a transaction ID', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ txid: 'withdrawal_txid_456' })
        });

        await expect(withdrawStateChainUtxo(
            'sc:utxo-1',
            'bc1q_dest',
            'mock-vault-data'
        )).rejects.toThrow('MISSING_AUTHORITATIVE_EVIDENCE');
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
