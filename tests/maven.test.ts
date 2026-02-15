import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMavenAssets, broadcastMavenTx } from '../services/maven';

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
                    assetId: 'mav123',
                    name: 'Maven Token',
                    symbol: 'MAV',
                    decimals: 8,
                    amount: '100000000',
                    valueUsd: '10.50'
                }]
            })
        });

        const assets = await fetchMavenAssets('bc1qtest');
        expect(assets).toHaveLength(1);
        expect(assets[0].symbol).toBe('MAV');
        expect(assets[0].balance).toBe(1); // 100000000 / 10^8
    });

    it('should handle empty or failed asset fetch', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404
        });

        const assets = await fetchMavenAssets('bc1qtest');
        expect(assets).toEqual([]);
    });

    it('should broadcast Maven transaction', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ txid: 'mav_txid_123' })
        });

        const txid = await broadcastMavenTx('010000...');
        expect(txid).toBe('mav_txid_123');
    });

    it('should throw error on broadcast failure', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            text: () => Promise.resolve('Broadcast failed')
        });

        await expect(broadcastMavenTx('010000...')).rejects.toThrow('Maven broadcast failed');
    });
});
