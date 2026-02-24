import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMavenAssets, createMavenTransfer } from '../services/maven';

// Mock dependencies
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('../services/network', () => ({
    endpointsFor: () => ({ MAVEN_API: 'https://mock.maven.api' }),
    fetchWithRetry: async (url: string, options: any) => global.fetch(url, options)
}));

vi.mock('../services/prices', () => ({
    fetchBtcPrice: vi.fn().mockResolvedValue(100000)
}));

vi.mock('../services/signer', () => ({
    requestEnclaveSignature: vi.fn().mockResolvedValue({
        signature: 'mock_signature',
        pubkey: 'mock_pubkey'
    })
}));

beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
});

describe('Maven Service', () => {
    it('should fetch Maven assets successfully', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                assets: [{
                    id: 'mav123',
                    name: 'Maven Token',
                    symbol: 'MAV',
                    balance: 1,
                    valueUsd: 10.50
                }]
            })
        });

        const assets = await fetchMavenAssets('bc1qtest');
        expect(assets).toHaveLength(1);
        expect(assets[0].symbol).toBe('MAV');
        expect(assets[0].balance).toBe(1);
    });

    it('should handle empty or failed asset fetch', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404
        });

        const assets = await fetchMavenAssets('bc1qtest');
        expect(assets).toEqual([]);
    });

    it('should create and broadcast Maven transfer', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ txid: 'mav_txid_123' })
        });

        const txid = await createMavenTransfer('asset_id', 10, 'recipient_addr', 'mock_vault');
        expect(txid).toBe('mav_txid_123');
    });
});
