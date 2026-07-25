import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import * as evidenceVerifier from '../services/value-operation-evidence-verifier';
import * as gateExports from '../services/value-operation-gate';
import { failClosed } from '../services/production-guard';
import {
    canonicalEncode,
    CanonicalEncodingError,
    createValueOperationEnvelope,
    createValueOperationGate,
    digestCanonicalPayload,
    digestValueOperationEnvelope,
    digestValueOperationIntent,
    encodeValueOperationEnvelope,
    VALUE_OPERATION_PAYLOAD_HASH_DOMAIN,
    VALUE_OPERATION_PAYLOAD_SCHEMA,
    type CanonicalValue,
    type EvidenceVerificationRequest,
    type EvidenceVerificationResult,
    type ValueOperationEnvelope,
    type ValueOperationGate,
    type ValueOperationIntent,
    type ValueOperationRequest,
} from '../services/value-operation-gate';

const verifierMock = vi.hoisted(() => ({
    implementation: undefined as undefined | ((request: EvidenceVerificationRequest) => Promise<EvidenceVerificationResult>),
}));

vi.mock('../services/value-operation-evidence-verifier', async (importOriginal) => {
    const actual = await importOriginal<typeof evidenceVerifier>();
    return {
        ...actual,
        verifyValueOperationEvidence: (request: EvidenceVerificationRequest) =>
            verifierMock.implementation?.(request) ?? actual.verifyValueOperationEvidence(request),
    };
});

const TEST_NOW_MS = 1_900_000_000_000;
const PROVIDER_DIGEST = '11'.repeat(32);
const EVIDENCE_DIGEST = '22'.repeat(32);

const TEST_PAYLOAD = Object.freeze({
    amount: '125000',
    asset: 'BTC',
    memo: Object.freeze(['phase-1', Object.freeze({ approved: true })]),
    target: null,
}) satisfies CanonicalValue;

const BASE_INTENT = Object.freeze({
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
}) satisfies ValueOperationIntent;

const EXPECTED_PAYLOAD_ENCODING =
    '{"amount":"125000","asset":"BTC","memo":["phase-1",{"approved":true}],"target":null}';
const EXPECTED_PAYLOAD_DOMAIN_INPUT =
    'conxius.wallet.value-operation-payload.sha256.v1\u0000'
    + '{"payload":{"amount":"125000","asset":"BTC","memo":["phase-1",{"approved":true}],"target":null},'
    + '"schema":"conxius.wallet.value-operation-payload.v1"}';
const EXPECTED_PAYLOAD_DIGEST = '9c36c60e6e6f68ec1888ffbd170fd66711dfbb49f65101f54cabb267955b162d';
const EXPECTED_ENVELOPE_ENCODING =
    '{"algorithm":"secp256k1-schnorr","audience":"native-signer","canonicalOperationDigest":"9c36c60e6e6f68ec1888ffbd170fd66711dfbb49f65101f54cabb267955b162d","chain":"bitcoin","challenge":"challenge-0001","domain":"conxius.example","envelopeVersion":1,"evidenceDigest":"2222222222222222222222222222222222222222222222222222222222222222","evidenceStatus":"verified","layer":"l1","network":"testnet","nonce":"nonce-0001","operationType":"transfer","protocolKeyIdentity":"test-key-01","providerDigest":"1111111111111111111111111111111111111111111111111111111111111111","providerStatus":"verified","purpose":"wallet-send","schema":"conxius.wallet.value-operation-envelope.v1"}';
const EXPECTED_ENVELOPE_DIGEST = 'a392d371d048bb32bec950d325aa23df92906cda6c1741000a707f4321278e9d';

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function baseEnvelope(): Readonly<ValueOperationEnvelope> {
    return createValueOperationEnvelope({
        operationType: BASE_INTENT.operationType,
        chain: BASE_INTENT.chain,
        layer: BASE_INTENT.layer,
        canonicalOperationDigest: digestCanonicalPayload(TEST_PAYLOAD),
        network: BASE_INTENT.network,
        purpose: BASE_INTENT.purpose,
        domain: BASE_INTENT.domain,
        nonce: BASE_INTENT.nonce,
        challenge: BASE_INTENT.challenge,
        audience: BASE_INTENT.audience,
        protocolKeyIdentity: 'test-key-01',
        algorithm: 'secp256k1-schnorr',
        providerStatus: 'verified',
        evidenceStatus: 'verified',
        providerDigest: PROVIDER_DIGEST,
        evidenceDigest: EVIDENCE_DIGEST,
    });
}

function baseRequest(overrides: Partial<ValueOperationRequest> = {}): ValueOperationRequest {
    const intent = overrides.intent ?? BASE_INTENT;
    return {
        intent,
        confirmation: overrides.confirmation ?? {
            status: 'confirmed',
            confirmationId: 'test-confirmation-01',
            intentDigest: digestValueOperationIntent(intent),
        },
        custody: overrides.custody ?? {
            boundary: 'wallet-native-enclave',
            protocolKeyIdentity: 'test-key-01',
            algorithm: 'secp256k1-schnorr',
        },
        evidence: overrides.evidence ?? { opaqueEvidence: { testMode: 'verified' } },
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
        localAuthorizationExpiresAtMs: TEST_NOW_MS + 10_000,
    };
}

function installTestVerifier(): void {
    verifierMock.implementation = async (request) => {
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
    };
}

async function authorize(gate: ValueOperationGate = createValueOperationGate()) {
    installTestVerifier();
    const outcome = await gate.authorize(baseRequest());
    expect(outcome.kind).toBe('authorized');
    if (outcome.kind !== 'authorized') throw new Error(`Test verifier did not authorize: ${outcome.reason}`);
    return { gate, outcome };
}

beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(TEST_NOW_MS);
});

afterEach(() => {
    verifierMock.implementation = undefined;
    vi.restoreAllMocks();
});

describe('value-operation canonical encoding and digest vectors', () => {
    it('matches stable encoding, byte-level domain input, and digest vectors', () => {
        const envelope = baseEnvelope();
        expect(canonicalEncode(TEST_PAYLOAD)).toBe(EXPECTED_PAYLOAD_ENCODING);
        expect(VALUE_OPERATION_PAYLOAD_SCHEMA).toBe('conxius.wallet.value-operation-payload.v1');
        expect(VALUE_OPERATION_PAYLOAD_HASH_DOMAIN).toBe('conxius.wallet.value-operation-payload.sha256.v1');
        expect(bytesToHex(new TextEncoder().encode(EXPECTED_PAYLOAD_DOMAIN_INPUT))).toMatch(/^[0-9a-f]+$/);
        expect(bytesToHex(sha256(new TextEncoder().encode(EXPECTED_PAYLOAD_DOMAIN_INPUT)))).toBe(EXPECTED_PAYLOAD_DIGEST);
        expect(digestCanonicalPayload(TEST_PAYLOAD)).toBe(EXPECTED_PAYLOAD_DIGEST);
        expect(encodeValueOperationEnvelope(envelope)).toBe(EXPECTED_ENVELOPE_ENCODING);
        expect(digestValueOperationEnvelope(envelope)).toBe(EXPECTED_ENVELOPE_DIGEST);
    });

    it('orders keys by UTF-16 code units, including non-BMP keys', () => {
        expect(canonicalEncode({ '\ue000': 2, '\u{10000}': 1 })).toBe('{"𐀀":1,"":2}');
    });

    it('uses ECMAScript JSON string escaping and number rendering', () => {
        expect(canonicalEncode({ escape: '"\\\b\f\n\r\t\u0000' }))
            .toBe('{"escape":"\\"\\\\\\b\\f\\n\\r\\t\\u0000"}');
        expect(canonicalEncode([0.000001, 1e-7, 1.25, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]))
            .toBe('[0.000001,1e-7,1.25,-9007199254740991,9007199254740991]');
    });

    it('is independent of object key insertion order but preserves array order', () => {
        const first = { z: 3, a: 1, nested: { y: 2, b: 1 } } as const;
        const second = { nested: { b: 1, y: 2 }, a: 1, z: 3 } as const;
        expect(canonicalEncode(first)).toBe(canonicalEncode(second));
        expect(digestCanonicalPayload(['a', 'b'])).not.toBe(digestCanonicalPayload(['b', 'a']));
    });

    it.each([
        ['undefined', { unsafe: undefined }],
        ['sparse array', (() => { const value = new Array(2); value[1] = 'present'; return value; })()],
        ['non-finite number', { unsafe: Number.POSITIVE_INFINITY }],
        ['negative zero', { unsafe: -0 }],
        ['unsafe positive integer', { unsafe: Number.MAX_SAFE_INTEGER + 1 }],
        ['unsafe negative integer', { unsafe: Number.MIN_SAFE_INTEGER - 1 }],
        ['BigInt', { unsafe: BigInt(1) }],
        ['function', { unsafe: () => true }],
        ['symbol value', { unsafe: Symbol('unsafe') }],
        ['unsupported prototype', new Date(0)],
        ['non-NFC string', { unsafe: 'e\u0301' }],
        ['non-NFC key', { 'e\u0301': true }],
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
        const cyclic: { self?: unknown } = {};
        cyclic.self = cyclic;
        for (const value of [withSymbol, withAccessor, arrayWithProperty, cyclic]) {
            expect(() => canonicalEncode(value as CanonicalValue)).toThrow(CanonicalEncodingError);
        }
    });

    it('does not claim a decimal format: monetary payload values use canonical strings', () => {
        expect(TEST_PAYLOAD.amount).toBe('125000');
        expect(canonicalEncode({ amount: '0.01000000' })).toBe('{"amount":"0.01000000"}');
    });
});

describe('strict public envelope helpers', () => {
    it('rejects missing, extra, and invalid envelope fields before encoding or hashing', () => {
        const envelope = baseEnvelope();
        const missing = { ...envelope } as Record<string, unknown>;
        delete missing.audience;
        const extra = { ...envelope, callerTrusted: true };
        const wrongVersion = { ...envelope, envelopeVersion: 2 };
        const badDigest = { ...envelope, providerDigest: 'AA'.repeat(32) };
        for (const malformed of [missing, extra, wrongVersion, badDigest]) {
            expect(() => encodeValueOperationEnvelope(malformed as unknown as ValueOperationEnvelope)).toThrow(CanonicalEncodingError);
            expect(() => digestValueOperationEnvelope(malformed as unknown as ValueOperationEnvelope)).toThrow(CanonicalEncodingError);
        }
    });

    it('rejects extra or missing fields in the public envelope constructor', () => {
        const valid = { ...baseEnvelope() } as Record<string, unknown>;
        delete valid.schema;
        delete valid.envelopeVersion;
        expect(() => createValueOperationEnvelope({ ...valid, extra: true } as never)).toThrow(CanonicalEncodingError);
        delete valid.audience;
        expect(() => createValueOperationEnvelope(valid as never)).toThrow(CanonicalEncodingError);
    });
});

describe('production verifier containment and mocked verifier outcomes', () => {
    it('ships no verifier/clock injection factory or generic authoritative-result acceptance API', async () => {
        expect('createTestEvaluationValueOperationGate' in gateExports).toBe(false);
        expect('acceptAuthoritativeResult' in createValueOperationGate()).toBe(false);
        expect(createValueOperationGate.length).toBe(0);

        const injected = { verify: vi.fn(async () => verifiedBinding({} as EvidenceVerificationRequest)) };
        const gate = (createValueOperationGate as unknown as (...args: unknown[]) => ValueOperationGate)(injected, () => 0);
        await expect(gate.authorize(baseRequest())).resolves.toEqual({ kind: 'unsupported', reason: 'unsupported_provider' });
        expect(injected.verify).not.toHaveBeenCalled();
    });

    it('keeps the concrete production verifier unconditionally unsupported', async () => {
        await expect(evidenceVerifier.verifyValueOperationEvidence({} as EvidenceVerificationRequest))
            .resolves.toEqual({ kind: 'unsupported', reason: 'unsupported_provider' });
        await expect(createValueOperationGate().authorize(baseRequest()))
            .resolves.toEqual({ kind: 'unsupported', reason: 'unsupported_provider' });
    });

    it('treats production/debug guard outputs and debug integrity tokens as opaque non-authoritative evidence', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const productionGuardSimulation = failClosed('Value operation evidence', {
            kind: 'simulated', marker: 'typescript-production-guard-simulation',
        }, false);
        const opaqueEvidenceValues = [
            productionGuardSimulation,
            { source: 'android-production-runtime-guard', buildType: 'debug', simulated: true },
            { token: 'play_integrity_token_debug_stub', status: 'verified', authoritative: true },
        ] as const;

        for (const opaqueEvidence of opaqueEvidenceValues) {
            const outcome = await createValueOperationGate().authorize(baseRequest({ evidence: { opaqueEvidence } }));
            expect(outcome).toEqual({ kind: 'unsupported', reason: 'unsupported_provider' });
            expect(outcome.kind).not.toMatch(/authorized|submitted|settled/);
        }

        const callerStatus = baseRequest() as unknown as Record<string, unknown>;
        callerStatus.providerStatus = productionGuardSimulation;
        callerStatus.evidenceStatus = 'play_integrity_token_debug_stub';
        await expect(createValueOperationGate().authorize(callerStatus))
            .resolves.toEqual({ kind: 'rejected', reason: 'malformed_value_operation' });
    });

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
    ])('maps mocked %s verifier evidence to %s/%s', async (testMode, kind, reason) => {
        installTestVerifier();
        const outcome = await createValueOperationGate().authorize(baseRequest({
            evidence: { opaqueEvidence: { testMode } },
        }));
        expect(outcome).toEqual({ kind, reason });
    });

    it('passes confirmation intent binding to the verifier without treating it as evidence', async () => {
        const verify = vi.fn(async (request: EvidenceVerificationRequest) => verifiedBinding(request));
        verifierMock.implementation = verify;
        const request = baseRequest();
        const outcome = await createValueOperationGate().authorize(request);
        expect(outcome.kind).toBe('authorized');
        expect(verify).toHaveBeenCalledWith(expect.objectContaining({
            intentDigest: request.confirmation.status === 'confirmed' ? request.confirmation.intentDigest : '',
            confirmation: {
                confirmationId: 'test-confirmation-01',
                intentDigest: request.confirmation.status === 'confirmed' ? request.confirmation.intentDigest : '',
            },
        }));
    });

    it('uses verifier statuses/digests and rejects caller status flags', async () => {
        installTestVerifier();
        const request = baseRequest() as unknown as Record<string, unknown>;
        request.evidence = {
            opaqueEvidence: { testMode: 'verified' },
            providerStatus: 'verified',
            evidenceStatus: 'verified',
            authoritative: true,
        };
        await expect(createValueOperationGate().authorize(request))
            .resolves.toEqual({ kind: 'rejected', reason: 'malformed_value_operation' });
    });

    it('uses verifier outcomes, not the local clock, for stale and replayed evidence', async () => {
        installTestVerifier();
        vi.mocked(Date.now).mockReturnValue(0);
        await expect(createValueOperationGate().authorize(baseRequest({ evidence: { opaqueEvidence: { testMode: 'stale' } } })))
            .resolves.toEqual({ kind: 'rejected', reason: 'stale_provider_evidence' });
        vi.mocked(Date.now).mockReturnValue(TEST_NOW_MS + 1_000_000);
        await expect(createValueOperationGate().authorize(baseRequest({ evidence: { opaqueEvidence: { testMode: 'replayed' } } })))
            .resolves.toEqual({ kind: 'quarantined', reason: 'replayed_provider_evidence' });
    });
});

describe('malformed bridge/JavaScript inputs', () => {
    it.each([
        ['null request', null],
        ['array request', []],
        ['missing request fields', {}],
        ['null intent', { ...baseRequest(), intent: null }],
        ['extra intent field', { ...baseRequest(), intent: { ...BASE_INTENT, callerTrusted: true } }],
        ['bad confirmation status', { ...baseRequest(), confirmation: { status: 'yes' } }],
        ['confirmation digest mismatch', {
            ...baseRequest(), confirmation: { status: 'confirmed', confirmationId: 'id', intentDigest: 'aa'.repeat(32) },
        }],
        ['bad custody', { ...baseRequest(), custody: { boundary: 'cloud', protocolKeyIdentity: 'id', algorithm: 'x' } }],
        ['non-canonical evidence', { ...baseRequest(), evidence: { opaqueEvidence: { text: 'e\u0301' } } }],
        ['oversized evidence', { ...baseRequest(), evidence: { opaqueEvidence: 'x'.repeat(65_537) } }],
    ])('returns typed malformed_value_operation without throwing: %s', async (_name, value) => {
        const promise = createValueOperationGate().authorize(value);
        await expect(promise).resolves.toEqual({ kind: 'rejected', reason: 'malformed_value_operation' });
    });

    it('does not invoke request getters or leak thrown details', async () => {
        const request = baseRequest() as unknown as Record<string, unknown>;
        Object.defineProperty(request, 'intent', { enumerable: true, get: () => { throw new Error('sensitive detail'); } });
        await expect(createValueOperationGate().authorize(request))
            .resolves.toEqual({ kind: 'rejected', reason: 'malformed_value_operation' });
    });

    it('rejects cancellation before invoking the verifier', async () => {
        const verify = vi.fn(async (request: EvidenceVerificationRequest) => verifiedBinding(request));
        verifierMock.implementation = verify;
        await expect(createValueOperationGate().authorize(baseRequest({ confirmation: { status: 'cancelled' } })))
            .resolves.toEqual({ kind: 'rejected', reason: 'user_cancelled' });
        expect(verify).not.toHaveBeenCalled();
    });
});

describe('registry-bound stage-scoped authorization capability', () => {
    it('consumes sign, broadcast, and settle once each with the same digest', async () => {
        const { gate, outcome } = await authorize();
        for (const stage of ['sign', 'broadcast', 'settle'] as const) {
            expect(() => gate.assertAndConsumeStage(outcome.capability, stage, outcome.envelopeDigest)).not.toThrow();
            expect(() => gate.assertAndConsumeStage(outcome.capability, stage, outcome.envelopeDigest))
                .toThrow('consumed_authorization');
        }
    });

    it('rejects forged, cross-gate, digest-mismatched, and unknown-stage use', async () => {
        const first = await authorize();
        const secondGate = createValueOperationGate();
        const forged = {
            kind: 'value-operation-authorization' as const,
            envelopeDigest: first.outcome.envelopeDigest,
            localExpiresAtMs: TEST_NOW_MS + 10_000,
        };
        expect(() => first.gate.assertAndConsumeStage(forged, 'sign', first.outcome.envelopeDigest))
            .toThrow('forged_authorization');
        expect(() => secondGate.assertAndConsumeStage(first.outcome.capability, 'sign', first.outcome.envelopeDigest))
            .toThrow('forged_authorization');
        expect(() => first.gate.assertAndConsumeStage(first.outcome.capability, 'sign', 'aa'.repeat(32)))
            .toThrow('mismatched_authorization');
        expect(() => first.gate.assertAndConsumeStage(first.outcome.capability, 'authorize' as never, first.outcome.envelopeDigest))
            .toThrow('mismatched_authorization');
    });

    it('uses local expiry only as conservative defense-in-depth', async () => {
        const { gate, outcome } = await authorize();
        vi.mocked(Date.now).mockReturnValue(TEST_NOW_MS - 1_000_000);
        expect(() => gate.assertAndConsumeStage(outcome.capability, 'sign', outcome.envelopeDigest)).not.toThrow();
        vi.mocked(Date.now).mockReturnValue(TEST_NOW_MS + 20_000);
        expect(() => gate.assertAndConsumeStage(outcome.capability, 'broadcast', outcome.envelopeDigest))
            .toThrow('expired_authorization');
    });

    it('has no generic API that can bless a caller-fabricated result value', async () => {
        const { gate, outcome } = await authorize();
        expect('acceptAuthoritativeResult' in gate).toBe(false);
        const fabricated = {
            kind: 'authoritative',
            envelopeDigest: outcome.envelopeDigest,
            authorization: outcome.capability,
            value: { transactionId: 'caller-shaped' },
        };
        expect(fabricated.value.transactionId).toBe('caller-shaped');
        expect(Object.values(gate)).not.toContain(fabricated.value);
    });
});
