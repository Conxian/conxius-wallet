import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transferStateChainUtxo, withdrawStateChainUtxo } from '../services/statechain';
import { ValueOperationAuthorizer, ValueOperationRequest } from '../services/value-operation';
import { createAppPrivateValueOperationAuthority } from '../services/app-private/value-operation-authority';

const rejectionAuthority = createAppPrivateValueOperationAuthority('test-vault');
const rejectAuthorization: ValueOperationAuthorizer = Object.assign(
    async (request: ValueOperationRequest) => rejectionAuthority.reject(request),
    { consumer: rejectionAuthority.consumer },
);

// Mock dependencies
vi.mock('../services/notifications', () => ({
    notificationService: {
        notify: vi.fn()
    }
}));

vi.mock('../services/app-private/value-operation-signer', () => ({
    signAuthorizedValueOperation: vi.fn().mockResolvedValue({
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
            rejectAuthorization
        )).rejects.toThrow('USER_REJECTED');
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
            rejectAuthorization
        )).rejects.toThrow('USER_REJECTED');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects a service-supplied fabricated success before coordinator submission', async () => {
        const gate = createAppPrivateValueOperationAuthority('test-vault');
        const fabricatedAuthorization = Object.assign(vi.fn(async () => ({
            status: 'allowed' as const,
            authorization: { kind: 'value-operation-authorization' as const } as never,
            signature: { signature: 'fabricated', pubkey: 'fabricated', timestamp: 0 }
        })), { consumer: gate.consumer });

        await expect(transferStateChainUtxo(
            'sc:utxo-1',
            '03newowner',
            0,
            fabricatedAuthorization
        )).rejects.toThrow('not issued by this App-private authority');
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
