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

    it('should forfeit a VTXO', async () => {
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
