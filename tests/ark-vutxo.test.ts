import { describe, it, expect, vi } from 'vitest';
import { syncVtxos } from '../services/ark';

describe('Ark V-UTXO Management', () => {
  const mockAddr = 'bc1q' + 'x'.repeat(38);
  const mockVutxoId = '0x' + 'f'.repeat(64);

  it('should sync and map V-UTXOs correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ vtxos: [{ txid: mockVutxoId, amount: 1000000 }] })
    });

    const vtxos = await syncVtxos(mockAddr, 'mainnet');
    expect(vtxos).toHaveLength(1);
    expect(vtxos[0].txid).toBe(mockVutxoId);
  });
});
