import { beforeEach, describe, it, expect, vi } from 'vitest';
import * as protocol from '../services/protocol';

beforeEach(() => vi.clearAllMocks());

describe('Protocol Services', () => {
  const TEST_BTC_ADDRESS = ['bc1q', 'x'.repeat(38)].join('');

  it('should fetch BTC balance from correct endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ chain_stats: { funded_txo_sum: 100000, spent_txo_sum: 50000 } })
    });

    const balance = await protocol.fetchBtcBalance(TEST_BTC_ADDRESS, 'mainnet');
    expect(balance).toBe(50000); // 100000 - 50000 in sats
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('mempool.space/api/address'), expect.anything());
  });

  it('should handle fetchRgbAssets', async () => {
    const assets = await protocol.fetchRgbAssets(TEST_BTC_ADDRESS);
    expect(assets).toBeInstanceOf(Array);
  });

  it('should handle fetchArkBalances', async () => {
    const balances = await protocol.fetchArkBalances(TEST_BTC_ADDRESS);
    expect(balances).toBeInstanceOf(Array);
  });

  it('exports no raw ungated broadcast function', () => {
    expect('broadcastTransaction' in protocol).toBe(false);
  });

  it('does not report sBTC peg-in completion without a verifier', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(protocol.monitorSbtcPegIn('11'.repeat(32), 'testnet')).resolves.toMatchObject({
      kind: 'unsupported', reason: 'qualified_verifier_unavailable', subjectDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(protocol.monitorSbtcPegIn('not-a-txid', 'testnet'))
      .resolves.toEqual({ kind: 'rejected', reason: 'invalid_verification_subject' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not claim Merkle verification without a real light client', async () => {
    const client = new protocol.LightClient();
    await expect(client.verifyTransaction('22'.repeat(32), 'aabb')).resolves.toMatchObject({
      kind: 'unsupported', reason: 'qualified_verifier_unavailable', subjectDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(client.verifyTransaction('bad', 'aabb'))
      .resolves.toEqual({ kind: 'rejected', reason: 'invalid_verification_subject' });
  });

  it('never fabricates a native peg address', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(protocol.fetchNativePegAddress('Stacks', 'mainnet')).resolves.toEqual({
      kind: 'unsupported', reason: 'qualified_peg_address_provider_unavailable', layer: 'Stacks', network: 'mainnet',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Liquid Confidentiality & Agnostic Hardware SDK', () => {
  it('unblinds confidential Liquid address correctly', async () => {
    const liquid = await import('liquidjs-lib');
    const { deriveLiquidAddress, deriveConfidentialAddress, unblindAddress, isConfidentialAddress } = await import('../services/liquid');

    const pubkey = Buffer.from('0250929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0', 'hex');
    const blindingKey = Buffer.from('0239a7100b03ba25e8a1cd991e233816130eb5a53f09808a329d5926ec03099955', 'hex');

    const unconfidentialAddr = deriveLiquidAddress(pubkey, 'mainnet');
    const confidentialAddr = deriveConfidentialAddress(unconfidentialAddr, blindingKey);

    expect(isConfidentialAddress(confidentialAddr)).toBe(true);

    const unblinded = unblindAddress(confidentialAddr);
    expect(unblinded.unconfidentialAddress).toBe(unconfidentialAddr);
    expect(unblinded.blindingKey.toString('hex')).toBe(blindingKey.toString('hex'));
  });

  it('resolves Agnostic Hardware Surface SDK capabilities', async () => {
    const { AgnosticHardwareSurfaceRegistry } = await import('../services/enclave-storage');

    const available = await AgnosticHardwareSurfaceRegistry.listAvailableSurfaces();
    expect(available).toBeInstanceOf(Array);

    const teeProvider = AgnosticHardwareSurfaceRegistry.getProvider('TEE');
    expect(teeProvider).toBeDefined();
    expect(teeProvider?.surfaceType).toBe('TEE');
  });
});
