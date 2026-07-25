import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createValueOperationRequest,
  digestValueOperationEnvelope,
  evaluateValueOperation,
  executeValueOperation,
  resetValueOperationReplayCacheForTests,
  ValueOperationEvidenceDecision,
  ValueOperationRequest,
} from '../services/value-operation';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  requestEnclaveSignature: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.isNativePlatform } }));
vi.mock('../services/signer', () => ({ requestEnclaveSignature: mocks.requestEnclaveSignature }));

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

function verifiedDecision(
  value: ValueOperationRequest,
): Extract<ValueOperationEvidenceDecision, { status: 'verified' }> {
  return {
    status: 'verified', provider: 'external-verifier-adapter', providerStatus: 'authoritative',
    requestDigest: value.intentDigest, nonce: value.nonce, audience: value.audience,
    keyIdentity: value.keyIdentity, algorithm: value.algorithm,
    evidenceDigests: ['a'.repeat(64), 'b'.repeat(64)],
    issuedAt: '2026-07-25T03:59:00.000Z', expiresAt: '2026-07-25T04:05:00.000Z',
  };
}

describe('value-operation gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetValueOperationReplayCacheForTests();
    mocks.isNativePlatform.mockReturnValue(true);
  });

  it('canonicalizes deterministically and binds envelope mutations', () => {
    const first = request({ z: 1, nested: { b: 2, a: 1 }, a: 2 });
    const reordered = request({ a: 2, nested: { a: 1, b: 2 }, z: 1 });
    expect(first.intentDigest).toBe(reordered.intentDigest);

    const allowed = evaluateValueOperation(first, { userConfirmed: true, now, evidenceDecision: verifiedDecision(first) });
    expect(allowed.status).toBe('allowed');
    if (allowed.status !== 'allowed') return;
    expect(digestValueOperationEnvelope({ ...allowed.authorization.envelope, audience: 'other' }))
      .not.toBe(allowed.authorization.envelopeDigest);
  });

  it('rejects non-JSON payload types instead of using colliding tags', () => {
    expect(() => request(1n)).toThrow('Unsupported canonical value');
    expect(() => request(new Uint8Array([1]))).toThrow('Unsupported canonical value');
  });

  it.each([
    ['missing', 'quarantined'], ['stale', 'quarantined'], ['revoked', 'quarantined'],
    ['mismatched', 'quarantined'], ['non-authoritative', 'simulated'], ['unsupported', 'unsupported'],
  ] as const)('fails closed for %s verifier evidence', (status, expectedStatus) => {
    const value = request();
    const decision: ValueOperationEvidenceDecision = {
      status,
      providerStatus: status === 'unsupported' ? 'unsupported' : 'non-authoritative',
      code: `EVIDENCE_${status.toUpperCase().replace('-', '_')}`,
      reason: 'Evidence rejected by verifier.',
    };
    expect(evaluateValueOperation(value, { userConfirmed: true, now, evidenceDecision: decision }).status)
      .toBe(expectedStatus);
  });

  it('ignores caller-fabricated evidence properties', async () => {
    const value = { ...request(), evidence: verifiedDecision(request()) } as ValueOperationRequest;
    const outcome = await executeValueOperation(value, 'vault', { userConfirmed: true, now });
    expect(outcome).toMatchObject({ status: 'quarantined', code: 'MISSING_AUTHORITATIVE_EVIDENCE' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('does not accept a feature-caller injected evidence adapter', async () => {
    const value = request();
    const injectedVerify = vi.fn().mockResolvedValue(verifiedDecision(value));
    const outcome = await executeValueOperation(value, 'vault', {
      userConfirmed: true, now, evidenceAdapter: { verify: injectedVerify },
    } as Parameters<typeof executeValueOperation>[2]);
    expect(outcome).toMatchObject({ status: 'quarantined', code: 'MISSING_AUTHORITATIVE_EVIDENCE' });
    expect(injectedVerify).not.toHaveBeenCalled();
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it.each([
    ['payload', { payload: { amountSats: 2000, destination: 'bc1qattacker' } }],
    ['chain layer', { chainLayer: 'Ethereum' }],
    ['signing type', { signingType: 'message' }],
    ['confirmation text', { description: 'Authorize unrelated operation' }],
  ] as const)('rejects mutation of the bound %s before signer use', async (_field, mutation) => {
    const original = request();
    const mutated = { ...original, ...mutation } as ValueOperationRequest;
    const outcome = await executeValueOperation(mutated, 'vault', { userConfirmed: true, now });
    expect(outcome).toMatchObject({ status: 'rejected', code: 'REQUEST_MUTATION_DETECTED' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('rejects stale envelopes before signer use', async () => {
    const outcome = await executeValueOperation(request(), 'vault', {
      userConfirmed: true, now: new Date('2026-07-25T04:06:00.000Z'),
    });
    expect(outcome).toMatchObject({ status: 'quarantined', code: 'STALE_ENVELOPE' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('never invokes the web/worker signer while authoritative verification is unwired', async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const outcome = await executeValueOperation(request(), 'vault', { userConfirmed: true, now });
    expect(outcome).toMatchObject({ status: 'quarantined', code: 'MISSING_AUTHORITATIVE_EVIDENCE' });
    expect(mocks.requestEnclaveSignature).not.toHaveBeenCalled();
  });

  it('creates an allowed authorization only for a request-bound verifier decision', () => {
    const value = request();
    expect(evaluateValueOperation(value, { userConfirmed: true, now, evidenceDecision: verifiedDecision(value) }).status)
      .toBe('allowed');
  });

  it('rejects verifier request-binding mismatches', () => {
    const value = request();
    const outcome = evaluateValueOperation(value, {
      userConfirmed: true, now,
      evidenceDecision: { ...verifiedDecision(value), nonce: 'different-nonce' },
    });
    expect(outcome).toMatchObject({ status: 'rejected', code: 'EVIDENCE_REQUEST_MISMATCH' });
  });
});
