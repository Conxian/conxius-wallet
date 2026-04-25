import { describe, it, expect, vi } from 'vitest';
import { fetchBtcBalance, fetchRgbAssets, fetchArkBalances } from '../services/protocol';

describe('Protocol Services', () => {
  const TEST_BTC_ADDRESS = ['bc1q', 'x'.repeat(38)].join('');

  it('should fetch BTC balance from correct endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ chain_stats: { funded_txo_sum: 100000, spent_txo_sum: 50000 } })
    });

    const balance = await fetchBtcBalance(TEST_BTC_ADDRESS, 'mainnet');
    expect(balance).toBe(50000); // 100000 - 50000 in sats
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('mempool.space/api/address'), expect.anything());
  });

  it('should handle fetchRgbAssets', async () => {
    const assets = await fetchRgbAssets(TEST_BTC_ADDRESS);
    expect(assets).toBeInstanceOf(Array);
  });

  it('should handle fetchArkBalances', async () => {
    const balances = await fetchArkBalances(TEST_BTC_ADDRESS);
    expect(balances).toBeInstanceOf(Array);
  });
});
