import { describe, it, expect, vi } from 'vitest';
import { MultiSigWallet } from '../services/multisig';

describe('MultiSig Wallet (Bridged)', () => {
  const mockQuorum = {
    m: 2,
    n: 3,
    network: 'testnet' as const,
    signers: [
        { id: 1, name: 'Local 1', type: 'local' as const, key: '02' + '2'.repeat(64), status: 'ready' as const },
        { id: 2, name: 'Local 2', type: 'local' as const, key: '03' + '3'.repeat(64), status: 'ready' as const },
        { id: 3, name: 'Hard 1', type: 'hardware' as const, key: '02' + '4'.repeat(64), status: 'ready' as const }
    ]
  };

  it('should initialize and list signers correctly', () => {
    const wallet = new MultiSigWallet(mockQuorum);
    expect(wallet.config.m).toBe(2);
    expect(wallet.config.signers).toHaveLength(3);
  });

  it('should fetch UTXOs using the correct network endpoint', async () => {
    const wallet = new MultiSigWallet(mockQuorum);
    const mockAddr = 'tb1q' + 'z'.repeat(38);

    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ txid: 'f'.repeat(64), vout: 0, amount: 100000 }]
    });

    const utxos = await wallet.fetchUtxos(mockAddr);
    expect(utxos).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('mempool.space/testnet/api'));
  });
});
