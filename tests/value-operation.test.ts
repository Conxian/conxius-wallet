import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeValueOperationBroadcastAuthorization,
  createValueOperationRequest,
  createWalletValueOperationGate,
  digestValueOperationEnvelope,
  requireValueOperationSignature,
  resetValueOperationReplayCacheForTests,
  ValueOperationEvidenceDecision,
  ValueOperationEvidenceRequest,
} from '../services/value-operation';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  requestEnclaveSignature: vi.fn(),
  getWalletEvidenceAdapter: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.isNativePlatform } }));
vi.mock('../services/signer', () => ({ requestEnclaveSignature: mocks.requestEnclaveSignature }));
vi.mock('../services/value-operation-evidence', () => ({
  getWalletEvidenceAdapter: mocks.getWalletEvidenceAdapter,
}));

const now = new Date('2026-07-25T04:00:00.000Z');

function request(payload: unknown = { amountSats: 1000, destination: 'bc1qexample' }) {
  return createValueOperationRequest({
    operationType: 'send', chainLayer: 'Mainnet', payload, network: 'mainnet',
    purpose: 'wallet.send.bitcoin', nonce: 'nonce-001', audience: 'conxius-wallet',
    keyIdentity: 'wallet.bitcoin.account-0', algorithm: 'secp256k1-ecdsa',
    issuedAt: '2026-07-25T03:59:00.000Z', expiresAt: '2026-07-25T04:05:00.000Z',
    signingType: 'psbt', description: 'Send bitcoin',
  });
}

function verifiedDecision(value: ValueOperationEvidenceRequest): Extract<ValueOperationEvidenceDecision, { status: 'verified' }> {
  return {
    status: 'verified', provider: 'external-verifier-adapter', providerStatus: 'authoritative',
    requestDigest: value.requestDigest, nonce: value.nonce, audience: value.audience,
    keyIdentity: value.keyIdentity, algorithm: value.algorithm,
    evidenceDigests: ['a'.repeat(64), 'b'.repeat(64)],
    issuedAt: '2026-07-25T03:59:00.000Z', expiresAt: '2026-07-25T04:05:00.000Z',
  };
}

function enableEvidence(decide = verifiedDecision) {
  mocks.getWalletEvidenceAdapter.mockReturnValue({ verify: vi.fn(async (value) => decide(value)) });
}

describe('value-operation gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    resetValueOperationReplayCacheForTests();
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.getWalletEvidenceAdapter.mockReturnValue(null);
    mocks.requestEnclaveSignature.mockResolvedValue({
      signature: 'native-signature', pubkey: 'native-pubkey',
      broadcastReadyHex: '020000000001', timestamp: now.getTime(),
    });
  });

  it('canonicalizes deterministically and binds envelope mutations', async () => {
    enableEvidence();
    const first = request({ z: 1, nested: { b: 2, a: 1 }, a: 2 });
    const reordered = request({ a: 2, nested: { a: 1, b: 2 }, z: 1 });
    expect(first.intentDigest).toBe(reordered.intentDigest);
    const allowed = await createWalletValueOperationGate('vault').confirm(first);
    expect(allowed.status).toBe('allowed');
    if (allowed.status !== 'allowed') return;
    expect(digestValueOperationEnvelope({ ...allowed.authorization.envelope, audience: 'other' }))
      .not.toBe(allowed.authorization.envelopeDigest);
  });

  it('rejects non-JSON payload types instead of using colliding tags', () => {
    expect(() => request(1n)).toThrow('Unsupported canonical value');
    expect(() => request(new Uint8Array([1]))).toThrow('Unsupported canonical value');
  });

  it('requires the app-owned confirmation queue and rejects cancellation before signing', () => {
    enableEvidence();
    const outcome = createWalletValueOperationGate('vault').reject(request());
    expect(outcome).toMatchObject({ status: 'rejected', code: 'USER_REJECTED' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('fails closed while wallet evidence verification is unwired', async () => {
    const outcome = await createWalletValueOperationGate('vault').confirm(request());
    expect(outcome).toMatchObject({ status: 'quarantined', code: 'MISSING_AUTHORITATIVE_EVIDENCE' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('rejects request mutation before evidence verification or signing', async () => {
    enableEvidence();
    const original = request();
    const mutated = { ...original, payload: { amountSats: 2000 } };
    const outcome = await createWalletValueOperationGate('vault').confirm(mutated);
    expect(outcome).toMatchObject({ status: 'rejected', code: 'REQUEST_MUTATION_DETECTED' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('rejects stale envelopes before signer use', async () => {
    vi.setSystemTime(new Date('2026-07-25T04:06:00.000Z'));
    const outcome = await createWalletValueOperationGate('vault').confirm(request());
    expect(outcome).toMatchObject({ status: 'quarantined', code: 'STALE_ENVELOPE' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('never invokes the web/worker signer on the enabled evidence path', async () => {
    enableEvidence();
    mocks.isNativePlatform.mockReturnValue(false);
    const outcome = await createWalletValueOperationGate('vault').confirm(request());
    expect(outcome).toMatchObject({ status: 'unsupported', code: 'NATIVE_VALUE_SIGNER_REQUIRED' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('rejects verifier request-binding mismatches', async () => {
    enableEvidence((value) => ({ ...verifiedDecision(value), nonce: 'different-nonce' }));
    const outcome = await createWalletValueOperationGate('vault').confirm(request());
    expect(outcome).toMatchObject({ status: 'rejected', code: 'EVIDENCE_REQUEST_MISMATCH' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('rejects a fabricated allowed result that was not issued by the gate', () => {
    expect(() => requireValueOperationSignature({
      status: 'allowed',
      authorization: { kind: 'value-operation-authorization' } as never,
      signature: { signature: 'fake', pubkey: 'fake', timestamp: 0 },
    })).toThrow('not issued by the wallet gate');
  });

  it('binds the exact signed transaction to an expiring one-time capability', async () => {
    enableEvidence();
    const outcome = await createWalletValueOperationGate('vault').confirm(request());
    expect(outcome.status).toBe('allowed');
    if (outcome.status !== 'allowed' || !outcome.signature?.broadcastReadyHex || !outcome.broadcastAuthorization) return;

    const broadcastAuthorization = outcome.broadcastAuthorization;
    const signedHex = outcome.signature.broadcastReadyHex;
    expect(() => consumeValueOperationBroadcastAuthorization(
      broadcastAuthorization,
      { signedHex: 'deadbeef', layer: 'Mainnet', network: 'mainnet' },
    )).toThrow('TRANSACTION_MISMATCH');
    expect(() => consumeValueOperationBroadcastAuthorization(
      broadcastAuthorization,
      { signedHex, layer: 'Mainnet', network: 'mainnet' },
    )).not.toThrow();
    expect(() => consumeValueOperationBroadcastAuthorization(
      broadcastAuthorization,
      { signedHex, layer: 'Mainnet', network: 'mainnet' },
    )).toThrow('REPLAYED');
  });
});
