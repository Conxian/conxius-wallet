import { beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastAuthorizedTransaction } from '../services/protocol';
import {
  createValueOperationRequest,
  resetValueOperationReplayCacheForTests,
  ValueOperationBroadcastAuthorization,
} from '../services/value-operation';
import { createAppPrivateValueOperationAuthority } from '../services/app-private/value-operation-authority';

const createWalletValueOperationGate = createAppPrivateValueOperationAuthority;

const mocks = vi.hoisted(() => ({
  fetchWithRetry: vi.fn(),
  requestEnclaveSignature: vi.fn(),
  getWalletEvidenceAdapter: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('../services/network', () => ({
  endpointsFor: () => ({ BTC_API: 'https://bitcoin.example', STX_API: 'https://stacks.example' }),
  fetchWithRetry: mocks.fetchWithRetry,
}));
vi.mock('../services/signer', () => ({ requestEnclaveSignature: mocks.requestEnclaveSignature }));
vi.mock('../services/value-operation-evidence', () => ({
  getWalletEvidenceAdapter: mocks.getWalletEvidenceAdapter,
}));

const baseTime = new Date('2026-07-25T04:00:00.000Z');

async function authorize(nonce: string) {
  const request = createValueOperationRequest({
    operationType: 'send', chainLayer: 'Mainnet',
    payload: { psbt: `psbt-${nonce}` }, network: 'mainnet',
    purpose: 'wallet.send.bitcoin', nonce, audience: 'conxius-wallet',
    keyIdentity: 'wallet.bitcoin.account-0', algorithm: 'secp256k1-ecdsa',
    issuedAt: '2026-07-25T03:59:00.000Z', expiresAt: '2026-07-25T04:05:00.000Z',
    signingType: 'psbt', description: 'Send bitcoin',
  });
  const outcome = await createWalletValueOperationGate('vault').confirm(request);
  if (outcome.status !== 'allowed' || !outcome.signature?.broadcastReadyHex || !outcome.broadcastAuthorization) {
    throw new Error(`Expected broadcast-ready outcome, received ${outcome.status}`);
  }
  return {
    hex: outcome.signature.broadcastReadyHex,
    authorization: outcome.broadcastAuthorization,
  };
}

describe('authorized broadcast boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);
    resetValueOperationReplayCacheForTests();
    mocks.getWalletEvidenceAdapter.mockReturnValue({
      verify: vi.fn(async (value) => ({
        status: 'verified', provider: 'test-wallet-adapter', providerStatus: 'authoritative',
        requestDigest: value.requestDigest, nonce: value.nonce, audience: value.audience,
        keyIdentity: value.keyIdentity, algorithm: value.algorithm, evidenceDigests: [],
        issuedAt: '2026-07-25T03:59:00.000Z', expiresAt: '2026-07-25T04:05:00.000Z',
      })),
    });
    mocks.requestEnclaveSignature.mockResolvedValue({
      signature: 'native-signature', pubkey: 'native-pubkey',
      broadcastReadyHex: '020000000001', timestamp: baseTime.getTime(),
    });
    mocks.fetchWithRetry.mockResolvedValue({ ok: true, text: async () => 'authoritative-txid' });
  });

  it('rejects fabricated authorization before network I/O', async () => {
    await expect(broadcastAuthorizedTransaction(
      '020000000001',
      { kind: 'value-operation-broadcast-authorization' } as ValueOperationBroadcastAuthorization,
      'Mainnet',
      'mainnet',
    )).rejects.toThrow('BROADCAST_AUTHORIZATION_INVALID');
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('rejects a mismatched transaction before network I/O', async () => {
    const { authorization } = await authorize('mismatch');
    await expect(broadcastAuthorizedTransaction('deadbeef', authorization, 'Mainnet', 'mainnet'))
      .rejects.toThrow('TRANSACTION_MISMATCH');
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('rejects stale authorization before network I/O', async () => {
    const { hex, authorization } = await authorize('stale');
    vi.setSystemTime(new Date(baseTime.getTime() + 61_000));
    await expect(broadcastAuthorizedTransaction(hex, authorization, 'Mainnet', 'mainnet'))
      .rejects.toThrow('BROADCAST_AUTHORIZATION_STALE');
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('rejects layer or network substitution before network I/O', async () => {
    const { hex, authorization } = await authorize('context-mismatch');
    await expect(broadcastAuthorizedTransaction(hex, authorization, 'Stacks', 'mainnet'))
      .rejects.toThrow('CONTEXT_MISMATCH');
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('rejects replay and performs network I/O only once', async () => {
    const { hex, authorization } = await authorize('replay');
    await expect(broadcastAuthorizedTransaction(hex, authorization, 'Mainnet', 'mainnet'))
      .resolves.toBe('authoritative-txid');
    await expect(broadcastAuthorizedTransaction(hex, authorization, 'Mainnet', 'mainnet'))
      .rejects.toThrow('BROADCAST_AUTHORIZATION_REPLAYED');
    expect(mocks.fetchWithRetry).toHaveBeenCalledTimes(1);
  });

  it('rejects denied or missing authorization before network I/O', async () => {
    await expect(broadcastAuthorizedTransaction(
      '020000000001',
      undefined as unknown as ValueOperationBroadcastAuthorization,
      'Mainnet',
      'mainnet',
    )).rejects.toThrow('BROADCAST_AUTHORIZATION_INVALID');
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('submits the exact bound transaction for a valid capability', async () => {
    const { hex, authorization } = await authorize('positive');
    await expect(broadcastAuthorizedTransaction(hex, authorization, 'Mainnet', 'mainnet'))
      .resolves.toBe('authoritative-txid');
    expect(mocks.fetchWithRetry).toHaveBeenCalledWith('https://bitcoin.example/tx', {
      method: 'POST', body: hex, headers: { 'Content-Type': 'text/plain' },
    });
  });
});
