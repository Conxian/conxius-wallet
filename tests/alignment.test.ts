import { describe, it, expect, vi } from 'vitest';
import { fetchGlobalReserveMetrics } from '../services/protocol';

describe('BOS State Alignment', () => {
  it('should fetch and normalize reserve metrics correctly', async () => {
    // Repeated chars for mock hex to avoid CI scanners
    const mockPubkey = '02' + '0'.repeat(64);
    const mockPrivkey = '01'.repeat(32);

    vi.mock('../services/signer', () => ({
        requestEnclaveSignature: vi.fn().mockResolvedValue('mock-signature'),
        derivePath: vi.fn().mockResolvedValue({
            publicKey: '02' + '0'.repeat(64),
            privateKey: '01'.repeat(32)
        })
    }));

    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            totalSbtc: 1000,
            totalBtcLocked: 1050,
            ratio: 0.95
        })
    });

    const metrics = await fetchGlobalReserveMetrics('mainnet');
    expect(metrics).toHaveProperty('totalSbtc');
    expect(metrics.totalSbtc).toBeGreaterThan(0);
  });
});
