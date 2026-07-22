import { describe, it, expect, vi, beforeEach } from 'vitest';
import { liftToArk, forfeitVtxo, redeemVtxo, syncVtxos, VTXO } from '../services/ark';

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
    it('fails closed for the legacy lift API instead of fabricating a VTXO', async () => {
        await expect(liftToArk(100000, 'bc1qtest', 'asp:main')).rejects.toThrow(
            'Legacy Ark lift API is unsupported',
        );
    });

    it('should forfeit a VTXO successfully via API', async () => {
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

        const txid = await forfeitVtxo(mockVtxo, 'bc1qrecipient', 'mainnet', 'mock_vault');
        expect(txid).toBe('txid_real_network_123');
    });

    it('fails closed if the forfeit API fails instead of returning a synthetic txid', async () => {
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

        await expect(forfeitVtxo(mockVtxo, 'bc1qrecipient', 'mainnet', 'mock_vault')).rejects.toThrow('Network Error');
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
    it('should redeem a VTXO only after the API confirms a real transaction id', async () => {
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

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ txid: 'confirmed-ark-txid' })
        });

        const txid = await redeemVtxo(mockVtxo, 'mock_vault', 'mainnet');
        expect(txid).toBe('confirmed-ark-txid');
    });

    it('fails closed when redemption lacks a confirmed transaction id', async () => {
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

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ status: 'accepted' })
        });

        await expect(redeemVtxo(mockVtxo, 'mock_vault', 'mainnet')).rejects.toThrow(
            'did not include a confirmed transaction id',
        );
    });
});
