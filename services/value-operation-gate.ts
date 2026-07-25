import { sha256 } from '@noble/hashes/sha2.js';

export const VALUE_OPERATION_PAYLOAD_SCHEMA = 'conxius.wallet.value-operation-payload.v1' as const;
export const VALUE_OPERATION_ENVELOPE_SCHEMA = 'conxius.wallet.value-operation-envelope.v1' as const;
export const VALUE_OPERATION_PAYLOAD_HASH_DOMAIN = 'conxius.wallet.value-operation-payload.sha256.v1' as const;
export const VALUE_OPERATION_ENVELOPE_HASH_DOMAIN = 'conxius.wallet.value-operation-envelope.sha256.v1' as const;

const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const capabilityRegistry = new WeakMap<object, CapabilityRecord>();
const textEncoder = new TextEncoder();

export type CanonicalValue = null | boolean | number | string | readonly CanonicalValue[] | CanonicalObject;

export interface CanonicalObject {
    readonly [key: string]: CanonicalValue;
}

export type ValueOperationReasonCode =
    | 'user_cancelled'
    | 'missing_provider_evidence'
    | 'malformed_provider_evidence'
    | 'stale_provider_evidence'
    | 'unsupported_provider'
    | 'unsupported_protocol_key_custody'
    | 'revoked_provider_evidence'
    | 'mismatched_provider_evidence'
    | 'non_authoritative_provider_evidence'
    | 'replayed_provider_evidence'
    | 'unavailable_provider_evidence'
    | 'simulated_provider_evidence'
    | 'debug_provider_evidence'
    | 'synthetic_provider_evidence'
    | 'malformed_value_operation'
    | 'malformed_protocol_key_custody'
    | 'envelope_digest_mismatch'
    | 'expired_authorization'
    | 'forged_authorization'
    | 'mismatched_authorization'
    | 'consumed_authorization';

export class CanonicalEncodingError extends Error {
    readonly code = 'unsafe_canonical_value';
    readonly path: string;
    readonly violation: string;

    constructor(path: string, violation: string) {
        super(`Canonical value rejected at ${path}: ${violation}`);
        this.name = 'CanonicalEncodingError';
        this.path = path;
        this.violation = violation;
    }
}

export class ValueOperationAuthorizationError extends Error {
    readonly reason: Extract<ValueOperationReasonCode,
        | 'expired_authorization'
        | 'forged_authorization'
        | 'mismatched_authorization'
        | 'consumed_authorization'
        | 'non_authoritative_provider_evidence'>;

    constructor(reason: ValueOperationAuthorizationError['reason']) {
        super(reason);
        this.name = 'ValueOperationAuthorizationError';
        this.reason = reason;
    }
}

export interface ValueOperationIntent {
    readonly operationType: string;
    readonly chain: string;
    readonly layer: string;
    readonly payload: CanonicalValue;
    readonly network: string;
    readonly purpose: string;
    readonly domain: string;
    readonly nonce: string;
    readonly challenge: string;
    readonly audience: string;
}

export type UserConfirmation =
    | Readonly<{ status: 'confirmed'; confirmationId: string }>
    | Readonly<{ status: 'cancelled' }>;

export interface ProtocolKeyCustody {
    readonly boundary: 'wallet-native-enclave' | 'unsupported';
    readonly protocolKeyIdentity: string;
    readonly algorithm: string;
}

/**
* Opaque evidence is passed only to the verifier boundary. Claim fields are
* deliberately ignored by the gate and exist to make accidental caller trust
* visible in tests and migrations.
*/
export interface ProviderEvidenceInput {
    readonly opaqueEvidence?: unknown;
    readonly providerStatus?: unknown;
    readonly evidenceStatus?: unknown;
    readonly authoritative?: unknown;
}

export interface ValueOperationRequest {
    readonly intent: ValueOperationIntent;
    readonly confirmation: UserConfirmation;
    readonly custody: ProtocolKeyCustody;
    readonly evidence: ProviderEvidenceInput;
}

export interface ValueOperationEnvelope {
    readonly schema: typeof VALUE_OPERATION_ENVELOPE_SCHEMA;
    readonly envelopeVersion: 1;
    readonly operationType: string;
    readonly chain: string;
    readonly layer: string;
    readonly canonicalOperationDigest: string;
    readonly network: string;
    readonly purpose: string;
    readonly domain: string;
    readonly nonce: string;
    readonly challenge: string;
    readonly audience: string;
    readonly protocolKeyIdentity: string;
    readonly algorithm: string;
    readonly providerStatus: string;
    readonly evidenceStatus: string;
    readonly providerDigest: string;
    readonly evidenceDigest: string;
}

export interface VerifiedEvidenceBinding {
    readonly kind: 'verified';
    readonly resultClass: 'authoritative';
    readonly providerStatus: 'verified';
    readonly evidenceStatus: 'verified';
    readonly providerDigest: string;
    readonly evidenceDigest: string;
    readonly boundEnvelopeDigest: string;
    readonly issuedAtMs: number;
    readonly expiresAtMs: number;
}

export type EvidenceVerificationResult =
    | VerifiedEvidenceBinding
    | Readonly<{
        kind: 'rejected';
        reason: Exclude<ValueOperationReasonCode,
            | 'user_cancelled'
            | 'unsupported_provider'
            | 'unsupported_protocol_key_custody'
            | 'simulated_provider_evidence'
            | 'debug_provider_evidence'
            | 'synthetic_provider_evidence'
            | 'expired_authorization'
            | 'forged_authorization'
            | 'mismatched_authorization'
            | 'consumed_authorization'>;
    }>
    | Readonly<{
        kind: 'unsupported';
        reason: 'unsupported_provider' | 'unsupported_protocol_key_custody';
    }>
    | Readonly<{
        kind: 'simulated';
        reason: 'simulated_provider_evidence' | 'debug_provider_evidence' | 'synthetic_provider_evidence';
    }>
    | Readonly<{
        kind: 'quarantined';
        reason: 'replayed_provider_evidence' | 'unavailable_provider_evidence' | 'revoked_provider_evidence';
    }>;

export interface EvidenceVerificationRequest {
    readonly intent: Readonly<Omit<ValueOperationIntent, 'payload'>>;
    readonly canonicalOperationDigest: string;
    readonly custody: Readonly<ProtocolKeyCustody>;
    readonly opaqueEvidence: unknown;
}

export interface TrustedValueEvidenceVerifier {
    verify(request: EvidenceVerificationRequest): Promise<EvidenceVerificationResult>;
}

export interface ValueOperationAuthorizationCapability {
    readonly kind: 'value-operation-authorization';
    readonly envelopeDigest: string;
    readonly expiresAtMs: number;
}

export interface AuthorizedValueOperation {
    readonly kind: 'authorized';
    readonly envelope: Readonly<ValueOperationEnvelope>;
    readonly envelopeDigest: string;
    readonly capability: ValueOperationAuthorizationCapability;
}

export type ValueOperationGateOutcome =
    | AuthorizedValueOperation
    | Readonly<{ kind: 'rejected'; reason: ValueOperationReasonCode }>
    | Readonly<{ kind: 'unsupported'; reason: ValueOperationReasonCode }>
    | Readonly<{ kind: 'simulated'; reason: ValueOperationReasonCode }>
    | Readonly<{ kind: 'quarantined'; reason: ValueOperationReasonCode }>;

export interface AuthoritativeValueOperationResult<T> {
    readonly kind: 'authoritative';
    readonly envelopeDigest: string;
    readonly authorization: ValueOperationAuthorizationCapability;
    readonly value: T;
}

export interface NonAuthoritativeValueOperationResult<T = unknown> {
    readonly kind: 'simulated' | 'debug' | 'synthetic';
    readonly value?: T;
}

export type ValueOperationResult<T> = AuthoritativeValueOperationResult<T> | NonAuthoritativeValueOperationResult<T>;

export interface ValueOperationGate {
    authorize(request: ValueOperationRequest): Promise<ValueOperationGateOutcome>;
    assertAndConsumeAuthorization(
        capability: ValueOperationAuthorizationCapability,
        expectedEnvelopeDigest: string,
    ): void;
    acceptAuthoritativeResult<T>(result: ValueOperationResult<T>, expectedEnvelopeDigest: string): T;
}

interface CapabilityRecord {
    readonly gate: object;
    readonly envelopeDigest: string;
    readonly expiresAtMs: number;
    consumed: boolean;
}

interface GateOptions {
    readonly verifier: TrustedValueEvidenceVerifier;
    readonly now: () => number;
}

function compareCodeUnits(left: string, right: string): number {
    if (left === right) return 0;
    return left < right ? -1 : 1;
}

function assertCanonicalString(value: string, path: string): void {
    if (value.normalize('NFC') !== value) {
        throw new CanonicalEncodingError(path, 'strings must already be NFC-normalized');
    }

    for (let index = 0; index < value.length; index += 1) {
        const codeUnit = value.charCodeAt(index);
        if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) {
                throw new CanonicalEncodingError(path, 'unpaired high surrogate');
            }
            index += 1;
        } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
            throw new CanonicalEncodingError(path, 'unpaired low surrogate');
        }
    }
}

function encodeCanonicalValue(value: unknown, path: string, ancestors: Set<object>): string {
    if (value === null) return 'null';

    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'string':
            assertCanonicalString(value, path);
            return JSON.stringify(value);
        case 'number':
            if (!Number.isFinite(value)) {
                throw new CanonicalEncodingError(path, 'numbers must be finite');
            }
            if (Object.is(value, -0)) {
                throw new CanonicalEncodingError(path, 'negative zero is ambiguous');
            }
            if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
                throw new CanonicalEncodingError(path, 'integers must be safe integers');
            }
            return JSON.stringify(value);
        case 'undefined':
        case 'bigint':
        case 'function':
        case 'symbol':
            throw new CanonicalEncodingError(path, `${typeof value} is unsupported`);
        case 'object':
            break;
        default:
            throw new CanonicalEncodingError(path, 'unsupported value');
    }

    const objectValue = value as object;
    if (ancestors.has(objectValue)) {
        throw new CanonicalEncodingError(path, 'cyclic references are unsupported');
    }
    ancestors.add(objectValue);

    try {
        if (Array.isArray(value)) {
            const arrayKeys = Reflect.ownKeys(value);
            for (let index = 0; index < value.length; index += 1) {
                if (!Object.hasOwn(value, index)) {
                    throw new CanonicalEncodingError(`${path}[${index}]`, 'sparse arrays are unsupported');
                }
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
                    throw new CanonicalEncodingError(`${path}[${index}]`, 'array accessors are unsupported');
                }
            }
            const extraKeys = arrayKeys.filter((key) => {
                if (key === 'length') return false;
                if (typeof key === 'symbol') return true;
                return !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length;
            });
            if (extraKeys.length > 0) {
                throw new CanonicalEncodingError(path, 'array properties are unsupported');
            }
            return `[${value.map((entry, index) => encodeCanonicalValue(entry, `${path}[${index}]`, ancestors)).join(',')}]`;
        }

        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new CanonicalEncodingError(path, 'only plain objects are supported');
        }

        const ownKeys = Reflect.ownKeys(value);
        if (ownKeys.some((key) => typeof key === 'symbol')) {
            throw new CanonicalEncodingError(path, 'symbol properties are unsupported');
        }

        const stringKeys = ownKeys as string[];
        for (const key of stringKeys) {
            assertCanonicalString(key, `${path}.<key>`);
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
                throw new CanonicalEncodingError(`${path}.${key}`, 'accessors and non-enumerable properties are unsupported');
            }
        }

        return `{${stringKeys
            .sort(compareCodeUnits)
            .map((key) => `${JSON.stringify(key)}:${encodeCanonicalValue((value as Record<string, unknown>)[key], `${path}.${key}`, ancestors)}`)
            .join(',')}}`;
    } finally {
        ancestors.delete(objectValue);
    }
}

export function canonicalEncode(value: CanonicalValue): string {
    return encodeCanonicalValue(value, '$', new Set());
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function domainSeparatedDigest(domain: string, canonicalEncoding: string): string {
    return bytesToHex(sha256(textEncoder.encode(`${domain}\u0000${canonicalEncoding}`)));
}

export function digestCanonicalPayload(payload: CanonicalValue): string {
    const encoded = canonicalEncode({
        schema: VALUE_OPERATION_PAYLOAD_SCHEMA,
        payload,
    });
    return domainSeparatedDigest(VALUE_OPERATION_PAYLOAD_HASH_DOMAIN, encoded);
}

function assertNonEmptyString(value: string, field: string): void {
    if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
        throw new CanonicalEncodingError(`$.${field}`, 'must be a non-empty, unpadded string');
    }
    assertCanonicalString(value, `$.${field}`);
}

function assertDigest(value: string, field: string): void {
    if (!HEX_DIGEST_PATTERN.test(value)) {
        throw new CanonicalEncodingError(`$.${field}`, 'must be a lowercase SHA-256 hex digest');
    }
}

export function createValueOperationEnvelope(
    fields: Omit<ValueOperationEnvelope, 'schema' | 'envelopeVersion'>,
): Readonly<ValueOperationEnvelope> {
    for (const field of [
        'operationType',
        'chain',
        'layer',
        'network',
        'purpose',
        'domain',
        'nonce',
        'challenge',
        'audience',
        'protocolKeyIdentity',
        'algorithm',
        'providerStatus',
        'evidenceStatus',
    ] as const) {
        assertNonEmptyString(fields[field], field);
    }
    assertDigest(fields.canonicalOperationDigest, 'canonicalOperationDigest');
    assertDigest(fields.providerDigest, 'providerDigest');
    assertDigest(fields.evidenceDigest, 'evidenceDigest');

    return Object.freeze({
        schema: VALUE_OPERATION_ENVELOPE_SCHEMA,
        envelopeVersion: 1,
        ...fields,
    });
}

export function encodeValueOperationEnvelope(envelope: ValueOperationEnvelope): string {
    return canonicalEncode(envelope as unknown as CanonicalObject);
}

export function digestValueOperationEnvelope(envelope: ValueOperationEnvelope): string {
    return domainSeparatedDigest(VALUE_OPERATION_ENVELOPE_HASH_DOMAIN, encodeValueOperationEnvelope(envelope));
}

function freezeIntentWithoutPayload(intent: ValueOperationIntent): Readonly<Omit<ValueOperationIntent, 'payload'>> {
    return Object.freeze({
        operationType: intent.operationType,
        chain: intent.chain,
        layer: intent.layer,
        network: intent.network,
        purpose: intent.purpose,
        domain: intent.domain,
        nonce: intent.nonce,
        challenge: intent.challenge,
        audience: intent.audience,
    });
}

function rejected(reason: ValueOperationReasonCode): ValueOperationGateOutcome {
    return Object.freeze({ kind: 'rejected', reason });
}

function mapVerifierOutcome(result: Exclude<EvidenceVerificationResult, VerifiedEvidenceBinding>): ValueOperationGateOutcome {
    return Object.freeze({ kind: result.kind, reason: result.reason });
}

function validateRequestShape(request: ValueOperationRequest): string | null {
    const intentFields: readonly (keyof Omit<ValueOperationIntent, 'payload'>)[] = [
        'operationType', 'chain', 'layer', 'network', 'purpose', 'domain', 'nonce', 'challenge', 'audience',
    ];
    try {
        for (const field of intentFields) assertNonEmptyString(request.intent[field], field);
        digestCanonicalPayload(request.intent.payload);
    } catch {
        return 'malformed_value_operation';
    }

    try {
        assertNonEmptyString(request.custody.protocolKeyIdentity, 'protocolKeyIdentity');
        assertNonEmptyString(request.custody.algorithm, 'algorithm');
    } catch {
        return 'malformed_protocol_key_custody';
    }
    return null;
}

function createGate(options: GateOptions): ValueOperationGate {
    const gateIdentity = Object.freeze({});

    const gate: ValueOperationGate = {
        async authorize(request) {
            if (request.confirmation.status === 'cancelled') {
                return rejected('user_cancelled');
            }

            const malformedReason = validateRequestShape(request);
            if (malformedReason) return rejected(malformedReason as ValueOperationReasonCode);

            if (request.custody.boundary !== 'wallet-native-enclave') {
                return Object.freeze({ kind: 'unsupported', reason: 'unsupported_protocol_key_custody' });
            }

            const canonicalOperationDigest = digestCanonicalPayload(request.intent.payload);
            let verification: EvidenceVerificationResult;
            try {
                verification = await options.verifier.verify(Object.freeze({
                    intent: freezeIntentWithoutPayload(request.intent),
                    canonicalOperationDigest,
                    custody: Object.freeze({ ...request.custody }),
                    opaqueEvidence: request.evidence.opaqueEvidence,
                }));
            } catch {
                return Object.freeze({ kind: 'quarantined', reason: 'unavailable_provider_evidence' });
            }

            if (verification.kind !== 'verified') return mapVerifierOutcome(verification);

            if (
                verification.resultClass !== 'authoritative'
                || verification.providerStatus !== 'verified'
                || verification.evidenceStatus !== 'verified'
            ) {
                return rejected('non_authoritative_provider_evidence');
            }

            if (!HEX_DIGEST_PATTERN.test(verification.boundEnvelopeDigest)) {
                return rejected('malformed_provider_evidence');
            }

            const now = options.now();
            if (!Number.isSafeInteger(verification.issuedAtMs) || !Number.isSafeInteger(verification.expiresAtMs)) {
                return rejected('malformed_provider_evidence');
            }
            if (verification.issuedAtMs > now || verification.expiresAtMs <= now || verification.expiresAtMs <= verification.issuedAtMs) {
                return rejected('stale_provider_evidence');
            }

            let envelope: Readonly<ValueOperationEnvelope>;
            try {
                envelope = createValueOperationEnvelope({
                    operationType: request.intent.operationType,
                    chain: request.intent.chain,
                    layer: request.intent.layer,
                    canonicalOperationDigest,
                    network: request.intent.network,
                    purpose: request.intent.purpose,
                    domain: request.intent.domain,
                    nonce: request.intent.nonce,
                    challenge: request.intent.challenge,
                    audience: request.intent.audience,
                    protocolKeyIdentity: request.custody.protocolKeyIdentity,
                    algorithm: request.custody.algorithm,
                    providerStatus: verification.providerStatus,
                    evidenceStatus: verification.evidenceStatus,
                    providerDigest: verification.providerDigest,
                    evidenceDigest: verification.evidenceDigest,
                });
            } catch {
                return rejected('malformed_provider_evidence');
            }

            const envelopeDigest = digestValueOperationEnvelope(envelope);
            if (verification.boundEnvelopeDigest !== envelopeDigest) {
                return rejected('envelope_digest_mismatch');
            }

            const capability = Object.freeze({
                kind: 'value-operation-authorization' as const,
                envelopeDigest,
                expiresAtMs: verification.expiresAtMs,
            });
            capabilityRegistry.set(capability, {
                gate: gateIdentity,
                envelopeDigest,
                expiresAtMs: verification.expiresAtMs,
                consumed: false,
            });

            return Object.freeze({ kind: 'authorized', envelope, envelopeDigest, capability });
        },

        assertAndConsumeAuthorization(capability, expectedEnvelopeDigest) {
            const record = capabilityRegistry.get(capability);
            if (!record || record.gate !== gateIdentity) {
                throw new ValueOperationAuthorizationError('forged_authorization');
            }
            if (record.envelopeDigest !== expectedEnvelopeDigest || capability.envelopeDigest !== expectedEnvelopeDigest) {
                throw new ValueOperationAuthorizationError('mismatched_authorization');
            }
            if (record.consumed) {
                throw new ValueOperationAuthorizationError('consumed_authorization');
            }
            if (record.expiresAtMs <= options.now()) {
                throw new ValueOperationAuthorizationError('expired_authorization');
            }
            record.consumed = true;
        },

        acceptAuthoritativeResult<T>(result: ValueOperationResult<T>, expectedEnvelopeDigest: string): T {
            if (result.kind !== 'authoritative') {
                throw new ValueOperationAuthorizationError('non_authoritative_provider_evidence');
            }
            if (result.envelopeDigest !== expectedEnvelopeDigest) {
                throw new ValueOperationAuthorizationError('mismatched_authorization');
            }
            gate.assertAndConsumeAuthorization(result.authorization, expectedEnvelopeDigest);
            return result.value;
        },
    };

    return Object.freeze(gate);
}

const defaultProductionVerifier: TrustedValueEvidenceVerifier = Object.freeze({
    async verify() {
        return Object.freeze({ kind: 'unsupported', reason: 'unsupported_provider' });
    },
});

/** Production containment default: no provider verifier is currently available. */
export function createValueOperationGate(): ValueOperationGate {
    return createGate({ verifier: defaultProductionVerifier, now: Date.now });
}

/**
* Test/evaluation-only injection point. It is intentionally separate from the
* production factory and must not be used as a provider qualification claim.
*/
export function createTestEvaluationValueOperationGate(
    verifier: TrustedValueEvidenceVerifier,
    now: () => number,
): ValueOperationGate {
    return createGate({ verifier, now });
}
