import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transferStateChainUtxo, syncStateChainUtxos } from '../services/statechain';

// Mock dependencies
vi.mock('../services/notifications', () => ({
    notificationService: {
        notify: vi.fn(),
        notifyTransaction: vi.fn()
    }
}));

vi.mock('../services/signer', () => ({
    requestEnclaveSignature: vi.fn().mockResolvedValue({
        signature: 'mock_schnorr_signature_hex',
        pubkey: 'mock_pubkey',
        timestamp: Date.now()
    })
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
});

describe('StateChain Service', () => {
    it('should transfer a StateChain UTXO using Enclave', async () => {
        const result = await transferStateChainUtxo(
            'sc:utxo-1', 
            0, 
            '03newowner',
            'mock-vault-data'
        );
        
        expect(result.nextIndex).toBe(1);
        expect(result.signature).toBe('mock_schnorr_signature_hex');
    });

    it('should sync StateChain UTXOs', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                utxos: [{
                    id: 'sc:utxo-99',
                    amount: 1200000,
                    index: 0,
                    publicKey: '03' + 'a'.repeat(64),
                    status: 'active'
                }]
            })
        });

        const utxos = await syncStateChainUtxos('bc1qtest');
        expect(utxos.length).toBeGreaterThan(0);
        expect(utxos[0].id).toBe('sc:utxo-99');
    });
});
