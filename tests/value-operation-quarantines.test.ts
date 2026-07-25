import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayJoinService } from '../services/payjoin';
import { BoltzService } from '../services/boltz';

const mocks = vi.hoisted(() => ({ fetchWithRetry: vi.fn() }));

vi.mock('../services/protocol', () => ({ fetchWithRetry: mocks.fetchWithRetry }));

describe('value-operation quarantines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('quarantines PayJoin before receiver I/O, signer callback, finalization, or transaction material', async () => {
    const signer = vi.fn();
    const walletPsbt = { extractTransaction: vi.fn() };
    const service = new PayJoinService('mainnet');

    const result = (service.sendPayJoin as unknown as (...args: unknown[]) => Promise<never>)(
      'bitcoin:bc1qexample?pj=https%3A%2F%2Fpayjoin.example',
      walletPsbt,
      signer,
    );
    await expect(result).rejects.toThrow('PAYJOIN_QUARANTINED');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(signer).not.toHaveBeenCalled();
    expect(walletPsbt.extractTransaction).not.toHaveBeenCalled();
  });

  it('quarantines every Boltz swap initiation before randomness, software keys, or provider I/O', async () => {
    const random = vi.spyOn(globalThis.crypto, 'getRandomValues');

    await expect(BoltzService.createReverseSwap(10_000, 'bc1qexample', 'mainnet'))
      .rejects.toThrow('BOLTZ_SWAP_INITIATION_QUARANTINED');
    await expect(BoltzService.createSubmarineSwap(10_000, 'Liquid', 'ex1qexample', 'mainnet'))
      .rejects.toThrow('BOLTZ_SWAP_INITIATION_QUARANTINED');
    await expect(BoltzService.createSubmarineSwap(10_000, 'Lightning', 'lnbc1example', 'mainnet'))
      .rejects.toThrow('BOLTZ_SWAP_INITIATION_QUARANTINED');

    expect(random).not.toHaveBeenCalled();
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
    const source = readFileSync(join(process.cwd(), 'services/boltz.ts'), 'utf8');
    expect(source).not.toMatch(/ECPair|makeRandom|toWIF|refundPrivateKey/);
  });

  it('labels Boltz fee output as a non-authoritative estimate', async () => {
    await expect(BoltzService.estimateFees(100_000, 'mainnet')).resolves.toMatchObject({
      kind: 'estimate',
      authoritative: false,
    });
  });
});
