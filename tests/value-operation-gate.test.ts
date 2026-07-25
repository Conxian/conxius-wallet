import { describe, expect, it, vi } from 'vitest';
import {
    canonicalEncode,
    CanonicalEncodingError,
    createTestEvaluationValueOperationGate,
    createValueOperationEnvelope,
    createValueOperationGate,
    digestCanonicalPayload,
    digestValueOperationEnvelope,
    encodeValueOperationEnvelope,
    type CanonicalValue,
    type EvidenceVerificationRequest,
    type EvidenceVerificationResult,
    type TrustedValueEvidenceVerifier,
    type ValueOperationEnvelope,
    type ValueOperationGate,
    type ValueOperationRequest,
} from '../services/value-operation-gate';

const TEST_NOW_MS = 1_900_000_000_000;
const PROVIDER_DIGEST = '11'.repeat(32);
const EVIDENCE_DIGEST = '22'.repeat(32);

const TEST_PAYLOAD = Object.freeze({
    amount: 125000,
    asset: 'BTC',
    memo: Object.freeze(['phase-1', Object.freeze({ approved: true })]),
    target: null,
}) satisfies CanonicalValue;

const EXPECTED_PAYLOAD_ENCODING =
    '{"amount":125000,"asset":"BTC","memo":["phase-1",{"approved":true}],"target":null}';
const EXPECTED_PAYLOAD_DIGEST = '9fade3fa75803fe3918e92785cc7ad0e6b59b1faa2579ac4ed66c5375fd96f90';
const EXPECTED_ENVELOPE_ENCODING =
    '{"algorithm":"secp256k1-schnorr","audience":"native-signer","canonicalOperationDigest":"9fade3fa75803fe3918e92785cc7ad0e6b59b1faa2579ac4ed66c5375fd96f90","chain":"bitcoin","challenge":"challenge-0001","domain":"conxius.example","envelopeVersion":1,"evidenceDigest":"2222222222222222222222222222222222222222222222222222222222222222","evidenceStatus":"verified","layer":"l1","network":"testnet","nonce":"nonce-0001","operationType":"transfer","protocolKeyIdentity":"test-key-01","providerDigest":"1111111111111111111111111111111111111111111111111111111111111111","providerStatus":"verified","purpose":"wallet-send","schema":"conxius.wallet.value-operation-envelope.v1"}';
const EXPECTED_ENVELOPE_DIGEST = '57a27a8bf7d5547fd1fe8d8df1bf23c75787c1a5e67ce535abf0ff41d7118cb9';

function baseEnvelope(): Readonly<ValueOperationEnvelope> {
    return createValueOperationEnvelope({
        operationType: 'transfer',
        chain: 'bitcoin',
        layer: 'l1',
        canonicalOperationDigest: digestCanonicalPayload(TEST_PAYLOAD),
        network: 'testnet',
        purpose: 'wallet-send',
        domain: 'conxius.example',
        nonce: 'nonce-0001',
        challenge: 'challenge-0001',
        audience: 'native-signer',
        protocolKeyIdentity: 'test-key-01',
        algorithm: 'secp256k1-schnorr',
        providerStatus: 'verified',
        evidenceStatus: 'verified',
        providerDigest: PROVIDER_DIGEST,
        evidenceDigest: EVIDENCE_DIGEST,
    });
}

function baseRequest(overrides: Partial<ValueOperationRequest> = {}): ValueOperationRequest {
    return {
        intent: {
            operationType: 'transfer',
            chain: 'bitcoin',
            layer: 'l1',
            payload: TEST_PAYLOAD,
            network: 'testnet',
            purpose: 'wallet-send',
            domain: 'conxius.example',
            nonce: 'nonce-0001',
            challenge: 'challenge-0001',
            audience: 'native-signer',
        },
        confirmation: { status: 'confirmed', confirmationId: 'test-confirmation-01' },
        custody: {
            boundary: 'wallet-native-enclave',
            protocolKeyIdentity: 'test-key-01',
            algorithm: 'secp256k1-schnorr',
        },
        evidence: { opaqueEvidence: { testMode: 'verified' } },
        ...overrides,
    };
}

function verifiedBinding(request: EvidenceVerificationRequest): EvidenceVerificationResult {
    const envelope = createValueOperationEnvelope({
        operationType: request.intent.operationType,
        chain: request.intent.chain,
        layer: request.intent.layer,
        canonicalOperationDigest: request.canonicalOperationDigest,
        network: request.intent.network,
        purpose: request.intent.purpose,
        domain: request.intent.domain,
        nonce: request.intent.nonce,
        challenge: request.intent.challenge,
        audience: request.intent.audience,
        protocolKeyIdentity: request.custody.protocolKeyIdentity,
        algorithm: request.custody.algorithm,
        providerStatus: 'verified',
        evidenceStatus: 'verified',
        providerDigest: PROVIDER_DIGEST,
        evidenceDigest: EVIDENCE_DIGEST,
    });
    return {
        kind: 'verified',
        resultClass: 'authoritative',
        providerStatus: 'verified',
        evidenceStatus: 'verified',
        providerDigest: PROVIDER_DIGEST,
        evidenceDigest: EVIDENCE_DIGEST,
        boundEnvelopeDigest: digestValueOperationEnvelope(envelope),
        issuedAtMs: TEST_NOW_MS - 1_000,
        expiresAtMs: TEST_NOW_MS + 10_000,
    };
}

function testVerifier(): TrustedValueEvidenceVerifier {
    return {
        async verify(request) {
            const mode = (request.opaqueEvidence as { testMode?: string } | undefined)?.testMode;
            const outcomes: Record<string, EvidenceVerificationResult> = {
                missing: { kind: 'rejected', reason: 'missing_provider_evidence' },
                malformed: { kind: 'rejected', reason: 'malformed_provider_evidence' },
                stale: { kind: 'rejected', reason: 'stale_provider_evidence' },
                unsupported: { kind: 'unsupported', reason: 'unsupported_provider' },
                revoked: { kind: 'quarantined', reason: 'revoked_provider_evidence' },
                mismatched: { kind: 'rejected', reason: 'mismatched_provider_evidence' },
                nonAuthoritative: { kind: 'rejected', reason: 'non_authoritative_provider_evidence' },
                replayed: { kind: 'quarantined', reason: 'replayed_provider_evidence' },
                unavailable: { kind: 'quarantined', reason: 'unavailable_provider_evidence' },
                simulated: { kind: 'simulated', reason: 'simulated_provider_evidence' },
                debug: { kind: 'simulated', reason: 'debug_provider_evidence' },
                synthetic: { kind: 'simulated', reason: 'synthetic_provider_evidence' },
            };
            return outcomes[mode ?? ''] ?? verifiedBinding(request);
        },
    };
}

function createTestGate(now: () => number = () => TEST_NOW_MS): ValueOperationGate {
    return createTestEvaluationValueOperationGate(testVerifier(), now);
}

async function authorize(gate = createTestGate()) {
    const outcome = await gate.authorize(baseRequest());
    expect(outcome.kind).toBe('authorized');
    if (outcome.kind !== 'authorized') throw new Error(`Test verifier did not authorize: ${outcome.reason}`);
    return { gate, outcome };
}

describe('value-operation canonical encoding and digest vectors', () => {
    it('matches stable hard-coded payload and envelope vectors', () => {
        const envelope = baseEnvelope();
        expect(canonicalEncode(TEST_PAYLOAD)).toBe(EXPECTED_PAYLOAD_ENCODING);
        expect(digestCanonicalPayload(TEST_PAYLOAD)).toBe(EXPECTED_PAYLOAD_DIGEST);
        expect(encodeValueOperationEnvelope(envelope)).toBe(EXPECTED_ENVELOPE_ENCODING);
        expect(digestValueOperationEnvelope(envelope)).toBe(EXPECTED_ENVELOPE_DIGEST);
    });

    it('is independent of object key insertion order', () => {
        const first = { z: 3, a: 1, nested: { y: 2, b: 1 } } as const;
        const second = { nested: { b: 1, y: 2 }, a: 1, z: 3 } as const;
        expect(canonicalEncode(first)).toBe(canonicalEncode(second));
        expect(digestCanonicalPayload(first)).toBe(digestCanonicalPayload(second));
    });

    it('binds every required envelope field independently', () => {
        const envelope = baseEnvelope();
        const originalDigest = digestValueOperationEnvelope(envelope);
        const mutations: ReadonlyArray<readonly [keyof ValueOperationEnvelope, unknown]> = [
            ['schema', 'conxius.wallet.value-operation-envelope.v2'],
            ['envelopeVersion', 2],
            ['operationType', 'settlement'],
            ['chain', 'stacks'],
            ['layer', 'l2'],
            ['canonicalOperationDigest', digestCanonicalPayload({ ...TEST_PAYLOAD, amount: 125001 })],
            ['network', 'mainnet'],
            ['purpose', 'bridge'],
            ['domain', 'different.example'],
            ['nonce', 'nonce-0002'],
            ['challenge', 'challenge-0002'],
            ['audience', 'settlement-adapter'],
            ['protocolKeyIdentity', 'test-key-02'],
            ['algorithm', 'ecdsa-secp256k1'],
            ['providerStatus', 'revoked'],
            ['evidenceStatus', 'stale'],
            ['providerDigest', '33'.repeat(32)],
            ['evidenceDigest', '44'.repeat(32)],
        ];

        for (const [field, value] of mutations) {
            const mutated = { ...envelope, [field]: value } as ValueOperationEnvelope;
            expect(digestValueOperationEnvelope(mutated), field).not.toBe(originalDigest);
        }
    });

    it('preserves array order rather than sorting array values', () => {
        expect(digestCanonicalPayload(['a', 'b'])).not.toBe(digestCanonicalPayload(['b', 'a']));
    });

    it.each([
        ['undefined', { unsafe: undefined }],
        ['sparse array', (() => { const value = new Array(2); value[1] = 'present'; return value; })()],
        ['non-finite number', { unsafe: Number.POSITIVE_INFINITY }],
        ['negative zero', { unsafe: -0 }],
        ['unsafe integer', { unsafe: Number.MAX_SAFE_INTEGER + 1 }],
        ['BigInt', { unsafe: BigInt(1) }],
        ['function', { unsafe: () => true }],
        ['symbol value', { unsafe: Symbol('unsafe') }],
        ['unsupported prototype', new Date(0)],
        ['non-NFC string', { unsafe: 'e\u0301' }],
        ['unpaired surrogate', { unsafe: '\ud800' }],
    ])('rejects unsafe canonical value: %s', (_name, value) => {
        expect(() => canonicalEncode(value as CanonicalValue)).toThrow(CanonicalEncodingError);
    });

    it('rejects symbols, accessors, extra array properties, and cycles', () => {
        const withSymbol = { safe: true } as Record<PropertyKey, unknown>;
        withSymbol[Symbol('unsafe')] = true;
        const withAccessor = {};
        Object.defineProperty(withAccessor, 'unsafe', { enumerable: true, get: () => 'value' });
        const arrayWithProperty = ['safe'] as string[] & { extra?: string };
        arrayWithProperty.extra = 'unsafe';
        const arrayWithAccessor = ['safe'];
        Object.defineProperty(arrayWithAccessor, '0', { enumerable: true, get: () => 'unsafe' });
        const arrayWithHiddenProperty = ['safe'];
        Object.defineProperty(arrayWithHiddenProperty, 'extra', { enumerable: false, value: 'unsafe' });
        const cyclic: { self?: unknown } = {};
        cyclic.self = cyclic;

        for (const value of [
            withSymbol,
            withAccessor,
            arrayWithProperty,
            arrayWithAccessor,
            arrayWithHiddenProperty,
            cyclic,
        ]) {
            expect(() => canonicalEncode(value as CanonicalValue)).toThrow(CanonicalEncodingError);
        }
    });
});

describe('value-operation fail-closed outcomes', () => {
    it.each([
        ['missing', 'rejected', 'missing_provider_evidence'],
        ['malformed', 'rejected', 'malformed_provider_evidence'],
        ['stale', 'rejected', 'stale_provider_evidence'],
        ['unsupported', 'unsupported', 'unsupported_provider'],
        ['revoked', 'quarantined', 'revoked_provider_evidence'],
        ['mismatched', 'rejected', 'mismatched_provider_evidence'],
        ['nonAuthoritative', 'rejected', 'non_authoritative_provider_evidence'],
        ['replayed', 'quarantined', 'replayed_provider_evidence'],
        ['unavailable', 'quarantined', 'unavailable_provider_evidence'],
        ['simulated', 'simulated', 'simulated_provider_evidence'],
        ['debug', 'simulated', 'debug_provider_evidence'],
        ['synthetic', 'simulated', 'synthetic_provider_evidence'],
    ])('maps %s verifier evidence to %s/%s', async (testMode, kind, reason) => {
        const gate = createTestGate();
        const outcome = await gate.authorize(baseRequest({ evidence: { opaqueEvidence: { testMode } } }));
        expect(outcome).toEqual({ kind, reason });
    });

    it('rejects cancellation before consulting evidence', async () => {
        const verifier = { verify: vi.fn<TrustedValueEvidenceVerifier['verify']>() };
        const gate = createTestEvaluationValueOperationGate(verifier, () => TEST_NOW_MS);
        const outcome = await gate.authorize(baseRequest({ confirmation: { status: 'cancelled' } }));
        expect(outcome).toEqual({ kind: 'rejected', reason: 'user_cancelled' });
        expect(verifier.verify).not.toHaveBeenCalled();
    });

    it('keeps confirmation separate from unsupported protocol-key custody', async () => {
        const outcome = await createTestGate().authorize(baseRequest({
            custody: { boundary: 'unsupported', protocolKeyIdentity: 'test-key-01', algorithm: 'secp256k1-schnorr' },
        }));
        expect(outcome).toEqual({ kind: 'unsupported', reason: 'unsupported_protocol_key_custody' });
    });

    it('rejects malformed intent and custody before verifier authorization', async () => {
        const malformedIntent = await createTestGate().authorize(baseRequest({
            intent: { ...baseRequest().intent, nonce: ' padded ' },
        }));
        const malformedCustody = await createTestGate().authorize(baseRequest({
            custody: { boundary: 'wallet-native-enclave', protocolKeyIdentity: '', algorithm: 'test' },
        }));
        expect(malformedIntent).toEqual({ kind: 'rejected', reason: 'malformed_value_operation' });
        expect(malformedCustody).toEqual({ kind: 'rejected', reason: 'malformed_protocol_key_custody' });
    });

    it('rejects stale authoritative bindings even if the adapter reports verified', async () => {
        const verifier: TrustedValueEvidenceVerifier = {
            async verify(request) {
                return { ...verifiedBinding(request), issuedAtMs: TEST_NOW_MS - 2_000, expiresAtMs: TEST_NOW_MS - 1_000 };
            },
        };
        const outcome = await createTestEvaluationValueOperationGate(verifier, () => TEST_NOW_MS).authorize(baseRequest());
        expect(outcome).toEqual({ kind: 'rejected', reason: 'stale_provider_evidence' });
    });

    it('rejects a verifier result bound to any other envelope digest', async () => {
        const verifier: TrustedValueEvidenceVerifier = {
            async verify(request) {
                return { ...verifiedBinding(request), boundEnvelopeDigest: 'ff'.repeat(32) };
            },
        };
        const outcome = await createTestEvaluationValueOperationGate(verifier, () => TEST_NOW_MS).authorize(baseRequest());
        expect(outcome).toEqual({ kind: 'rejected', reason: 'envelope_digest_mismatch' });
    });

    it('quarantines verifier availability failures without exposing adapter errors', async () => {
        const verifier: TrustedValueEvidenceVerifier = {
            async verify() {
                throw new Error('test-only verifier detail that must not escape');
            },
        };
        const outcome = await createTestEvaluationValueOperationGate(verifier, () => TEST_NOW_MS).authorize(baseRequest());
        expect(outcome).toEqual({ kind: 'quarantined', reason: 'unavailable_provider_evidence' });
    });

    it('rejects a fabricated non-authoritative verifier success shape', async () => {
        const verifier: TrustedValueEvidenceVerifier = {
            async verify(request) {
                return { ...verifiedBinding(request), resultClass: 'simulated' } as unknown as EvidenceVerificationResult;
            },
        };
        const outcome = await createTestEvaluationValueOperationGate(verifier, () => TEST_NOW_MS).authorize(baseRequest());
        expect(outcome).toEqual({ kind: 'rejected', reason: 'non_authoritative_provider_evidence' });
    });

    it('defaults production verification to explicit unsupported and ignores caller status flags', async () => {
        const outcome = await createValueOperationGate().authorize(baseRequest({
            evidence: {
                opaqueEvidence: { testMode: 'verified' },
                providerStatus: 'verified',
                evidenceStatus: 'verified',
                authoritative: true,
            },
        }));
        expect(outcome).toEqual({ kind: 'unsupported', reason: 'unsupported_provider' });
    });
});

describe('runtime-bound one-shot authorization capability', () => {
    it('accepts the exact capability once and rejects reuse', async () => {
        const { gate, outcome } = await authorize();
        expect(() => gate.assertAndConsumeAuthorization(outcome.capability, outcome.envelopeDigest)).not.toThrow();
        expect(() => gate.assertAndConsumeAuthorization(outcome.capability, outcome.envelopeDigest)).toThrow('consumed_authorization');
    });

    it('rejects forged, cross-gate, and mismatched capabilities', async () => {
        const first = await authorize();
        const secondGate = createTestGate();
        const forged = {
            kind: 'value-operation-authorization' as const,
            envelopeDigest: first.outcome.envelopeDigest,
            expiresAtMs: TEST_NOW_MS + 10_000,
        };

        expect(() => first.gate.assertAndConsumeAuthorization(forged, first.outcome.envelopeDigest)).toThrow('forged_authorization');
        expect(() => secondGate.assertAndConsumeAuthorization(first.outcome.capability, first.outcome.envelopeDigest)).toThrow('forged_authorization');
        expect(() => first.gate.assertAndConsumeAuthorization(first.outcome.capability, 'aa'.repeat(32))).toThrow('mismatched_authorization');
        expect(() => first.gate.assertAndConsumeAuthorization(first.outcome.capability, first.outcome.envelopeDigest)).not.toThrow();
    });

    it('rejects an expired capability at the downstream boundary', async () => {
        let now = TEST_NOW_MS;
        const { gate, outcome } = await authorize(createTestGate(() => now));
        now = TEST_NOW_MS + 20_000;
        expect(() => gate.assertAndConsumeAuthorization(outcome.capability, outcome.envelopeDigest)).toThrow('expired_authorization');
    });

    it('requires an authoritative result with the exact live capability', async () => {
        const { gate, outcome } = await authorize();
        const result = {
            kind: 'authoritative' as const,
            envelopeDigest: outcome.envelopeDigest,
            authorization: outcome.capability,
            value: { transactionId: 'test-only-authoritative-result' },
        };
        expect(gate.acceptAuthoritativeResult(result, outcome.envelopeDigest)).toEqual(result.value);
    });

    it.each(['simulated', 'debug', 'synthetic'] as const)(
        'does not accept %s output as an authoritative result',
        async (kind) => {
            const { gate, outcome } = await authorize();
            expect(() => gate.acceptAuthoritativeResult({ kind, value: 'test-only' }, outcome.envelopeDigest))
                .toThrow('non_authoritative_provider_evidence');
        },
    );

    it('does not accept a caller-fabricated authoritative result flag', async () => {
        const { gate, outcome } = await authorize();
        const fabricated = {
            kind: 'authoritative' as const,
            envelopeDigest: outcome.envelopeDigest,
            authorization: {
                kind: 'value-operation-authorization' as const,
                envelopeDigest: outcome.envelopeDigest,
                expiresAtMs: TEST_NOW_MS + 10_000,
            },
            value: 'fabricated',
            authoritative: true,
        };
        expect(() => gate.acceptAuthoritativeResult(fabricated, outcome.envelopeDigest)).toThrow('forged_authorization');
    });
});
