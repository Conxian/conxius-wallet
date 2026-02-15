import { describe, it, expect, vi } from 'vitest';
import { finalizePsbtWithSigs, finalizePsbtWithSigsReturnBase64 } from '../services/psbt';
import { requestEnclaveSignature } from '../services/signer';
import { fetchGlobalReserveMetrics } from '../services/protocol';
import * as bitcoin from 'bitcoinjs-lib';

// Mock workerManager
vi.mock('../services/worker-manager', () => ({
  workerManager: {
    deriveSeed: vi.fn().mockResolvedValue(new Uint8Array(64).fill(0)),
    derivePath: vi.fn().mockResolvedValue({ publicKey: '020000000000000000000000000000000000000000000000000000000000000001', privateKey: '0101010101010101010101010101010101010101010101010101010101010101' })
  }
}));

describe('Alignment and Logic Fixes', () => {
  it('should finalize PSBT with signatures without scoping errors', () => {
    const pubkey = Buffer.alloc(33, 2);
    pubkey[0] = 0x02;
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network: bitcoin.networks.bitcoin });

    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
    psbt.addInput({
      hash: '00'.repeat(32),
      index: 0,
      witnessUtxo: {
        script: p2wpkh.output!,
        value: 1000n
      }
    });
    psbt.addOutput({ script: Buffer.from('0014' + '11'.repeat(20), 'hex'), value: 500n });

    const base64 = psbt.toBase64();
    const sigs = [{ index: 0, signature: Buffer.alloc(64, 1) }];

    // This should not throw anymore
    expect(() => finalizePsbtWithSigs(base64, sigs, pubkey, 'mainnet')).not.toThrow();
    expect(() => finalizePsbtWithSigsReturnBase64(base64, sigs, pubkey, 'mainnet')).not.toThrow();
  });

  it('should align Stacks signing logic in Web path', async () => {
    const mockRequest: any = {
      type: 'transaction',
      layer: 'Stacks' as const,
      payload: { hash: 'deadbeef'.repeat(8) },
      description: 'Test Stacks Signing'
    };

    const result = await requestEnclaveSignature(mockRequest, new Uint8Array(64).fill(0));
    expect(result).toBeDefined();
    expect(result.pubkey).toBeDefined();
    expect(result.signature).toBeDefined();
  });

  it('should fetch global reserve metrics correctly', async () => {
    const metrics = await fetchGlobalReserveMetrics();
    expect(metrics).not.toBeNull();
    if (metrics) {
        expect(metrics.length).toBeGreaterThan(0);
        expect(metrics[0].asset).toBeDefined();
        expect(metrics[0].collateralRatio).toBeGreaterThan(0);
    }
  });
});

describe('B2B Gateway Alignment', () => {
  it('should have Conxian Gateway in featured dApps', async () => {
    // This is a unit test check for the component logic if possible,
    // but since it's a static array in the component, we just check the file content existence
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(path.join(process.cwd(), 'components/Web3Browser.tsx'), 'utf8');
    expect(content).toContain('Conxian Gateway');
    expect(content).toContain('B2B Portal');
  });

  it('should have B2B institutional portal in DeFiDashboard', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(path.join(process.cwd(), 'components/DeFiDashboard.tsx'), 'utf8');
    expect(content).toContain('Institutional Liquidity');
    expect(content).toContain('Conxian Gateway');
  });
});
