import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deriveMultiSigAddress, fetchMultiSigBalances, buildMultiSigPsbt, MultiSigQuorum } from '../services/multisig';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
});

describe('Multi-Sig Service (Functional Alignment)', () => {
  const mockQuorum: MultiSigQuorum = {
    name: 'Test Vault',
    m: 2,
    n: 3,
    network: 'testnet',
    publicKeys: [
        '02' + '2'.repeat(64),
        '03' + '3'.repeat(64),
        '02' + '4'.repeat(64)
    ]
  };

  it('should derive a P2WSH address correctly', () => {
    const address = deriveMultiSigAddress(mockQuorum);
    expect(address).toBeDefined();
    expect(address.startsWith('tb1q')).toBe(true);
  });

  it('should fetch balances using the correct network endpoint', async () => {
    // 1st call for UTXOs
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ txid: 'f'.repeat(64), vout: 0, value: 100000 }]
    });
    // 2nd call for BTC Price
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 60000 } })
    });

    const balances = await fetchMultiSigBalances(mockQuorum);
    expect(balances).toHaveLength(1);
    expect(balances[0].balance).toBe(0.001);

    // Check that at least one call was to mempool.space testnet
    const calls = mockFetch.mock.calls.map(call => call[0]);
    expect(calls.some(url => url.includes('mempool.space/testnet/api'))).toBe(true);
  });

  it('should build a PSBT for spending from multi-sig', () => {
      const mockUtxos = [{ txid: 'f'.repeat(64), vout: 0, value: 100000 }];
      // Use a valid testnet address
      const recipient = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const psbt = buildMultiSigPsbt(mockQuorum, mockUtxos, recipient, 50000);
      expect(psbt).toBeDefined();
      expect(psbt.txInputs).toHaveLength(1);
      expect(psbt.txOutputs).toHaveLength(2); // Recipient + Change
  });
});
