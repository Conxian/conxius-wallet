import { describe, it, expect, vi, beforeEach } from 'vitest';
import { liftToArk, forfeitVtxo, syncVtxos, VTXO } from '../services/ark';

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

        const txid = await forfeitVtxo(mockVtxo, 'bc1qrecipient', 'mainnet');
        expect(txid).toBe('txid_real_network_123');
    });

    it('should fallback to simulation if forfeit API fails', async () => {
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

        const txid = await forfeitVtxo(mockVtxo, 'bc1qrecipient', 'mainnet');
        expect(txid).toContain('txid_forfeit_simulation');
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
    it('should redeem a VTXO successfully', async () => {
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
            json: () => Promise.resolve({ txid: 'txid_redemption_real' })
        });

        const { redeemVtxo } = await import('../services/ark');
        const txid = await redeemVtxo(mockVtxo, 'mock_vault', 'mainnet');
        expect(txid).toContain('txid_redemption_');
    });
});
