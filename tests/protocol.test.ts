import { describe, it, expect, vi } from 'vitest';
import { fetchBtcBalance, fetchRgbAssets, fetchArkBalances } from '../services/protocol';

describe('Protocol Services', () => {
  const TEST_BTC_ADDRESS = 'bc1q' + 'x'.repeat(38);

  it('should fetch BTC balance from correct endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ chain_stats: { funded_txo_sum: 100000, spent_txo_sum: 50000 } })
    });

    const balance = await fetchBtcBalance(TEST_BTC_ADDRESS, 'mainnet');
    expect(balance).toBe(50000);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('mempool.space/api/address'));
  });

  it('should fetch RGB assets via gateway', async () => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ([])
    });

    const mockAddr = 'bc1q' + '0'.repeat(38);
    const assets = await fetchRgbAssets(mockAddr);
    expect(assets).toBeInstanceOf(Array);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/rgb'));
  });

  it('should fetch Ark balances via gateway', async () => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ([])
    });

    const mockAddr = 'bc1q' + '0'.repeat(38);
    const balances = await fetchArkBalances(mockAddr);
    expect(balances).toBeInstanceOf(Array);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/ark'));
  });
});
