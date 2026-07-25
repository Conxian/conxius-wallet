import { describe, it, expect, vi, beforeEach } from 'vitest';
import { liftToArk, forfeitVtxo, syncVtxos, VTXO } from '../services/ark';
import { createWalletValueOperationGate, ValueOperationAuthorizer } from '../services/value-operation';

const rejectAuthorization: ValueOperationAuthorizer = async (request) =>
    createWalletValueOperationGate('test-vault').reject(request);

// Mock signer
vi.mock('../services/signer', () => ({
    requestEnclaveSignature: vi.fn().mockResolvedValue({ signature: 'mock_sig', pubkey: 'mock_pub' })
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
});

describe('Ark Service', () => {
    it('should lift amount to Ark VTXO (Legacy Shim)', async () => {
        const vtxo = await liftToArk(100000, 'bc1qtest', 'asp:main');
        expect(vtxo.id).toContain('vtxo:');
        expect(vtxo.amount).toBe(100000);
        expect(vtxo.status).toBe('lifting');
    });

    it('quarantines forfeit before signing or ASP broadcast without authoritative evidence', async () => {
        const mockVtxo: VTXO = {
            txid: 'txid123',
            vout: 0,
            amount: 100000,
            ownerPubkey: 'pubkey1',
            serverPubkey: 'serverpubkey1',
            roundTxid: 'round1',
            expiryHeight: 100,
            status: 'available'
        };

        // Mock successful API response
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ txid: 'txid_real_network_123' })
        });

        await expect(forfeitVtxo(mockVtxo, 'bc1qrecipient', 'mainnet', rejectAuthorization))
            .rejects.toThrow('USER_REJECTED');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('never falls back to a synthetic forfeit transaction ID', async () => {
        const mockVtxo: VTXO = {
            txid: 'txid123',
            vout: 0,
            amount: 100000,
            ownerPubkey: 'pubkey1',
            serverPubkey: 'serverpubkey1',
            roundTxid: 'round1',
            expiryHeight: 100,
            status: 'available'
        };

        // Mock persistent failure for all retries
        mockFetch.mockRejectedValue(new Error('Network Error'));

        await expect(forfeitVtxo(mockVtxo, 'bc1qrecipient', 'mainnet', rejectAuthorization))
            .rejects.toThrow('USER_REJECTED');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should sync VTXOs for an address', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                vtxos: [{
                    txid: 'txid123',
                    vout: 0,
                    amount: 50000,
                    ownerPubkey: 'pubkey1',
                    serverPubkey: 'serverpubkey1',
                    roundTxid: 'round1',
                    expiryHeight: 100,
                    status: 'available'
                }]
            })
        });

        const vtxos = await syncVtxos('bc1qtest', 'mainnet');
        expect(vtxos.length).toBeGreaterThan(0);
        expect(vtxos[0].status).toBe('available');
    });
});

describe('Ark Redemption', () => {
    it('quarantines redemption instead of returning a synthetic transaction ID', async () => {
        const mockVtxo: VTXO = {
            txid: 'txid_to_redeem',
            vout: 0,
            amount: 100000,
            ownerPubkey: 'pubkey1',
            serverPubkey: 'serverpubkey1',
            roundTxid: 'round1',
            expiryHeight: 100,
            status: 'available'
        };

        // Mock requestEnclaveSignature is harder because it's imported.
        // But we can mock it by mocking the module it comes from if needed.
        // For now, let's just check if it calls the API.

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ txid: 'redemption_tx_real' })
        });

        const { redeemVtxo } = await import('../services/ark');
        await expect(redeemVtxo(mockVtxo, rejectAuthorization, 'mainnet'))
            .rejects.toThrow('USER_REJECTED');
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
