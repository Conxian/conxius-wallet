import { sha256 } from '@noble/hashes/sha2.js';
import {
    verifyValueOperationEvidence,
    type EvidenceVerificationRequest,
    type EvidenceVerificationResult,
    type VerifiedEvidenceBinding,
} from './value-operation-evidence-verifier';

export const VALUE_OPERATION_PAYLOAD_SCHEMA = 'conxius.wallet.value-operation-payload.v1' as const;
export const VALUE_OPERATION_INTENT_SCHEMA = 'conxius.wallet.value-operation-intent.v1' as const;
export const VALUE_OPERATION_ENVELOPE_SCHEMA = 'conxius.wallet.value-operation-envelope.v1' as const;
export const VALUE_OPERATION_PAYLOAD_HASH_DOMAIN = 'conxius.wallet.value-operation-payload.sha256.v1' as const;
export const VALUE_OPERATION_INTENT_HASH_DOMAIN = 'conxius.wallet.value-operation-intent.sha256.v1' as const;
export const VALUE_OPERATION_ENVELOPE_HASH_DOMAIN = 'conxius.wallet.value-operation-envelope.sha256.v1' as const;

const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const MAX_OPAQUE_EVIDENCE_BYTES = 64 * 1024;
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

export type ValueOperationStage = 'sign' | 'broadcast' | 'settle';

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
        | 'consumed_authorization'>;

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

/**
* Confirmation records UX/user intent only. It is neither provider evidence
* nor custody proof and can never authorize an operation by itself.
*/
export type UserConfirmation =
    | Readonly<{ status: 'confirmed'; confirmationId: string; intentDigest: string }>
    | Readonly<{ status: 'cancelled' }>;

export interface ProtocolKeyCustody {
    readonly boundary: 'wallet-native-enclave' | 'unsupported';
    readonly protocolKeyIdentity: string;
    readonly algorithm: string;
}

/** Caller-supplied evidence is opaque and carries no trusted status flags. */
export interface ProviderEvidenceInput {
    readonly opaqueEvidence?: CanonicalValue;
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

export interface ValueOperationAuthorizationCapability {
    readonly kind: 'value-operation-authorization';
    readonly envelopeDigest: string;
    /** Wallet-local defense-in-depth deadline; not authoritative evidence freshness. */
    readonly localExpiresAtMs: number;
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

export interface ValueOperationGate {
    authorize(request: unknown): Promise<ValueOperationGateOutcome>;
    /** Verifies a live capability from this gate without consuming a stage. */
    assertAuthorization(
        capability: ValueOperationAuthorizationCapability,
        expectedEnvelopeDigest: string,
    ): void;
    /**
     * Gate-owned wrappers call this immediately before the named irreversible
     * stage. Stage consumption is process-local replay defense only.
     */
    assertAndConsumeStage(
        capability: ValueOperationAuthorizationCapability,
        stage: ValueOperationStage,
        expectedEnvelopeDigest: string,
    ): void;
}

interface CapabilityRecord {
    readonly gate: object;
    readonly envelopeDigest: string;
    readonly localExpiresAtMs: number;
    readonly consumedStages: Set<ValueOperationStage>;
}

const REQUEST_FIELDS = ['intent', 'confirmation', 'custody', 'evidence'] as const;
const INTENT_FIELDS = [
    'operationType', 'chain', 'layer', 'payload', 'network', 'purpose', 'domain', 'nonce', 'challenge', 'audience',
] as const;
const CUSTODY_FIELDS = ['boundary', 'protocolKeyIdentity', 'algorithm'] as const;
const EVIDENCE_FIELDS = ['opaqueEvidence'] as const;
const CONFIRMED_FIELDS = ['status', 'confirmationId', 'intentDigest'] as const;
const CANCELLED_FIELDS = ['status'] as const;
const ENVELOPE_FIELDS = [
    'schema', 'envelopeVersion', 'operationType', 'chain', 'layer', 'canonicalOperationDigest', 'network', 'purpose',
    'domain', 'nonce', 'challenge', 'audience', 'protocolKeyIdentity', 'algorithm', 'providerStatus', 'evidenceStatus',
    'providerDigest', 'evidenceDigest',
] as const;
const ENVELOPE_CREATION_FIELDS = ENVELOPE_FIELDS.filter(
    (field): field is Exclude<(typeof ENVELOPE_FIELDS)[number], 'schema' | 'envelopeVersion'> =>
        field !== 'schema' && field !== 'envelopeVersion',
);

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

/**
* Numbers use ECMAScript JSON rendering. This schema does not define decimal
* interoperability: monetary and precision-sensitive intent values MUST use
* application-defined canonical strings, not JSON numbers.
*/
function encodeCanonicalValue(value: unknown, path: string, ancestors: Set<object>): string {
    if (value === null) return 'null';

    switch (typeof value) {
        case 'boolean': return value ? 'true' : 'false';
        case 'string':
            assertCanonicalString(value, path);
            return JSON.stringify(value);
        case 'number':
            if (!Number.isFinite(value)) throw new CanonicalEncodingError(path, 'numbers must be finite');
            if (Object.is(value, -0)) throw new CanonicalEncodingError(path, 'negative zero is ambiguous');
            if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
                throw new CanonicalEncodingError(path, 'integers must be safe integers');
            }
            return JSON.stringify(value);
        case 'undefined':
        case 'bigint':
        case 'function':
        case 'symbol':
            throw new CanonicalEncodingError(path, `${typeof value} is unsupported`);
        case 'object': break;
        default: throw new CanonicalEncodingError(path, 'unsupported value');
    }

    const objectValue = value as object;
    if (ancestors.has(objectValue)) throw new CanonicalEncodingError(path, 'cyclic references are unsupported');
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
            if (extraKeys.length > 0) throw new CanonicalEncodingError(path, 'array properties are unsupported');
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
    const encoded = canonicalEncode({ schema: VALUE_OPERATION_PAYLOAD_SCHEMA, payload });
    return domainSeparatedDigest(VALUE_OPERATION_PAYLOAD_HASH_DOMAIN, encoded);
}

export function digestValueOperationIntent(intent: ValueOperationIntent): string {
    const validated = validateIntent(intent);
    const encoded = canonicalEncode({
        schema: VALUE_OPERATION_INTENT_SCHEMA,
        operationType: validated.operationType,
        chain: validated.chain,
        layer: validated.layer,
        canonicalOperationDigest: digestCanonicalPayload(validated.payload),
        network: validated.network,
        purpose: validated.purpose,
        domain: validated.domain,
        nonce: validated.nonce,
        challenge: validated.challenge,
        audience: validated.audience,
    });
    return domainSeparatedDigest(VALUE_OPERATION_INTENT_HASH_DOMAIN, encoded);
}

function assertPlainDataObject(value: unknown, path: string): asserts value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new CanonicalEncodingError(path, 'must be a plain object');
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new CanonicalEncodingError(path, 'must be a plain object');
    }
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') throw new CanonicalEncodingError(path, 'symbol properties are unsupported');
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
            throw new CanonicalEncodingError(`${path}.${key}`, 'accessors and non-enumerable properties are unsupported');
        }
    }
}

function assertExactFields(
    value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = [], path = '$',
): void {
    const keys = Object.keys(value);
    const allowed = new Set([...required, ...optional]);
    if (keys.some((key) => !allowed.has(key)) || required.some((key) => !Object.hasOwn(value, key))) {
        throw new CanonicalEncodingError(path, 'field set does not match schema');
    }
}

function assertNonEmptyString(value: unknown, field: string, maxLength = 512): asserts value is string {
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLength || value.trim() !== value) {
        throw new CanonicalEncodingError(`$.${field}`, `must be a non-empty, unpadded string of at most ${maxLength} code units`);
    }
    assertCanonicalString(value, `$.${field}`);
}

function assertDigest(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !HEX_DIGEST_PATTERN.test(value)) {
        throw new CanonicalEncodingError(`$.${field}`, 'must be a lowercase SHA-256 hex digest');
    }
}

function validateIntent(value: unknown): ValueOperationIntent {
    assertPlainDataObject(value, '$.intent');
    assertExactFields(value, INTENT_FIELDS, [], '$.intent');
    for (const field of INTENT_FIELDS.filter((field) => field !== 'payload')) {
        assertNonEmptyString(value[field], `intent.${field}`);
    }
    canonicalEncode(value.payload as CanonicalValue);
    return value as unknown as ValueOperationIntent;
}

function validateCustody(value: unknown): ProtocolKeyCustody {
    assertPlainDataObject(value, '$.custody');
    assertExactFields(value, CUSTODY_FIELDS, [], '$.custody');
    if (value.boundary !== 'wallet-native-enclave' && value.boundary !== 'unsupported') {
        throw new CanonicalEncodingError('$.custody.boundary', 'unsupported custody boundary');
    }
    assertNonEmptyString(value.protocolKeyIdentity, 'custody.protocolKeyIdentity');
    assertNonEmptyString(value.algorithm, 'custody.algorithm');
    return value as unknown as ProtocolKeyCustody;
}

function validateEvidence(value: unknown): ProviderEvidenceInput {
    assertPlainDataObject(value, '$.evidence');
    assertExactFields(value, [], EVIDENCE_FIELDS, '$.evidence');
    if (Object.hasOwn(value, 'opaqueEvidence')) {
        const encoded = canonicalEncode(value.opaqueEvidence as CanonicalValue);
        if (textEncoder.encode(encoded).byteLength > MAX_OPAQUE_EVIDENCE_BYTES) {
            throw new CanonicalEncodingError('$.evidence.opaqueEvidence', 'exceeds 65536 encoded bytes');
        }
    }
    return value as ProviderEvidenceInput;
}

function validateConfirmation(value: unknown, expectedIntentDigest: string): UserConfirmation {
    assertPlainDataObject(value, '$.confirmation');
    if (value.status === 'cancelled') {
        assertExactFields(value, CANCELLED_FIELDS, [], '$.confirmation');
        return value as unknown as UserConfirmation;
    }
    if (value.status !== 'confirmed') {
        throw new CanonicalEncodingError('$.confirmation.status', 'must be confirmed or cancelled');
    }
    assertExactFields(value, CONFIRMED_FIELDS, [], '$.confirmation');
    assertNonEmptyString(value.confirmationId, 'confirmation.confirmationId');
    assertDigest(value.intentDigest, 'confirmation.intentDigest');
    if (value.intentDigest !== expectedIntentDigest) {
        throw new CanonicalEncodingError('$.confirmation.intentDigest', 'does not bind the displayed intent');
    }
    return value as unknown as UserConfirmation;
}

function validateRequest(value: unknown): ValueOperationRequest {
    assertPlainDataObject(value, '$');
    assertExactFields(value, REQUEST_FIELDS);
    const intent = validateIntent(value.intent);
    const intentDigest = digestValueOperationIntent(intent);
    const confirmation = validateConfirmation(value.confirmation, intentDigest);
    const custody = validateCustody(value.custody);
    const evidence = validateEvidence(value.evidence);
    return { intent, confirmation, custody, evidence };
}

function validateEnvelope(value: unknown): ValueOperationEnvelope {
    assertPlainDataObject(value, '$');
    assertExactFields(value, ENVELOPE_FIELDS);
    if (value.schema !== VALUE_OPERATION_ENVELOPE_SCHEMA) {
        throw new CanonicalEncodingError('$.schema', 'unsupported envelope schema');
    }
    if (value.envelopeVersion !== 1) {
        throw new CanonicalEncodingError('$.envelopeVersion', 'unsupported envelope version');
    }
    for (const field of [
        'operationType', 'chain', 'layer', 'network', 'purpose', 'domain', 'nonce', 'challenge', 'audience',
        'protocolKeyIdentity', 'algorithm', 'providerStatus', 'evidenceStatus',
    ] as const) assertNonEmptyString(value[field], field);
    assertDigest(value.canonicalOperationDigest, 'canonicalOperationDigest');
    assertDigest(value.providerDigest, 'providerDigest');
    assertDigest(value.evidenceDigest, 'evidenceDigest');
    return value as unknown as ValueOperationEnvelope;
}

export function createValueOperationEnvelope(
    fields: Omit<ValueOperationEnvelope, 'schema' | 'envelopeVersion'>,
): Readonly<ValueOperationEnvelope> {
    assertPlainDataObject(fields, '$');
    assertExactFields(fields, ENVELOPE_CREATION_FIELDS);
    return Object.freeze(validateEnvelope({ schema: VALUE_OPERATION_ENVELOPE_SCHEMA, envelopeVersion: 1, ...fields }));
}

export function encodeValueOperationEnvelope(envelope: ValueOperationEnvelope): string {
    return canonicalEncode(validateEnvelope(envelope) as unknown as CanonicalObject);
}

export function digestValueOperationEnvelope(envelope: ValueOperationEnvelope): string {
    return domainSeparatedDigest(VALUE_OPERATION_ENVELOPE_HASH_DOMAIN, encodeValueOperationEnvelope(envelope));
}

function rejected(reason: ValueOperationReasonCode): ValueOperationGateOutcome {
    return Object.freeze({ kind: 'rejected', reason });
}

function freezeIntentWithoutPayload(intent: ValueOperationIntent): Readonly<Omit<ValueOperationIntent, 'payload'>> {
    return Object.freeze({
        operationType: intent.operationType, chain: intent.chain, layer: intent.layer, network: intent.network,
        purpose: intent.purpose, domain: intent.domain, nonce: intent.nonce, challenge: intent.challenge,
        audience: intent.audience,
    });
}

function isKnownNonVerifiedResult(result: unknown): result is Exclude<EvidenceVerificationResult, VerifiedEvidenceBinding> {
    try {
        assertPlainDataObject(result, '$.verification');
        assertExactFields(result, ['kind', 'reason'], [], '$.verification');
        if (typeof result.reason !== 'string' || typeof result.kind !== 'string') return false;
        const reasonsByKind: Record<string, readonly string[]> = {
            rejected: [
                'missing_provider_evidence', 'malformed_provider_evidence', 'stale_provider_evidence',
                'mismatched_provider_evidence', 'non_authoritative_provider_evidence', 'malformed_value_operation',
                'malformed_protocol_key_custody', 'envelope_digest_mismatch',
            ],
            unsupported: ['unsupported_provider', 'unsupported_protocol_key_custody'],
            simulated: ['simulated_provider_evidence', 'debug_provider_evidence', 'synthetic_provider_evidence'],
            quarantined: ['replayed_provider_evidence', 'unavailable_provider_evidence', 'revoked_provider_evidence'],
        };
        return reasonsByKind[result.kind]?.includes(result.reason) ?? false;
    } catch {
        return false;
    }
}

function validateVerifiedBinding(result: unknown): VerifiedEvidenceBinding | null {
    try {
        assertPlainDataObject(result, '$.verification');
        assertExactFields(result, [
            'kind', 'resultClass', 'providerStatus', 'evidenceStatus', 'providerDigest', 'evidenceDigest',
            'boundEnvelopeDigest', 'localAuthorizationExpiresAtMs',
        ], [], '$.verification');
        if (
            result.kind !== 'verified' || result.resultClass !== 'authoritative'
            || result.providerStatus !== 'verified' || result.evidenceStatus !== 'verified'
        ) return null;
        assertDigest(result.providerDigest, 'verification.providerDigest');
        assertDigest(result.evidenceDigest, 'verification.evidenceDigest');
        assertDigest(result.boundEnvelopeDigest, 'verification.boundEnvelopeDigest');
        if (!Number.isSafeInteger(result.localAuthorizationExpiresAtMs) || (result.localAuthorizationExpiresAtMs as number) < 0) {
            return null;
        }
        return result as unknown as VerifiedEvidenceBinding;
    } catch {
        return null;
    }
}

function createGate(): ValueOperationGate {
    const gateIdentity = Object.freeze({});
    const assertRegisteredAuthorization = (
        capability: ValueOperationAuthorizationCapability,
        expectedEnvelopeDigest: string,
    ): CapabilityRecord => {
        const record = capabilityRegistry.get(capability);
        if (!record || record.gate !== gateIdentity) {
            throw new ValueOperationAuthorizationError('forged_authorization');
        }
        if (record.envelopeDigest !== expectedEnvelopeDigest || capability.envelopeDigest !== expectedEnvelopeDigest) {
            throw new ValueOperationAuthorizationError('mismatched_authorization');
        }
        if (record.localExpiresAtMs <= Date.now()) {
            throw new ValueOperationAuthorizationError('expired_authorization');
        }
        return record;
    };
    const gate: ValueOperationGate = {
        async authorize(untrustedRequest) {
            let request: ValueOperationRequest;
            try {
                request = validateRequest(untrustedRequest);
            } catch {
                return rejected('malformed_value_operation');
            }
            if (request.confirmation.status === 'cancelled') return rejected('user_cancelled');
            if (request.custody.boundary !== 'wallet-native-enclave') {
                return Object.freeze({ kind: 'unsupported', reason: 'unsupported_protocol_key_custody' });
            }

            const canonicalOperationDigest = digestCanonicalPayload(request.intent.payload);
            const intentDigest = digestValueOperationIntent(request.intent);
            let verification: EvidenceVerificationResult;
            try {
                const verificationRequest: EvidenceVerificationRequest = Object.freeze({
                    intent: freezeIntentWithoutPayload(request.intent), intentDigest, canonicalOperationDigest,
                    confirmation: Object.freeze({
                        confirmationId: request.confirmation.confirmationId,
                        intentDigest: request.confirmation.intentDigest,
                    }),
                    custody: Object.freeze({ ...request.custody }), opaqueEvidence: request.evidence.opaqueEvidence,
                });
                verification = await verifyValueOperationEvidence(verificationRequest);
            } catch {
                return Object.freeze({ kind: 'quarantined', reason: 'unavailable_provider_evidence' });
            }

            if (isKnownNonVerifiedResult(verification)) {
                return Object.freeze({ kind: verification.kind, reason: verification.reason });
            }
            const verified = validateVerifiedBinding(verification);
            if (!verified) return rejected('malformed_provider_evidence');

            let envelope: Readonly<ValueOperationEnvelope>;
            try {
                envelope = createValueOperationEnvelope({
                    operationType: request.intent.operationType, chain: request.intent.chain, layer: request.intent.layer,
                    canonicalOperationDigest, network: request.intent.network, purpose: request.intent.purpose,
                    domain: request.intent.domain, nonce: request.intent.nonce, challenge: request.intent.challenge,
                    audience: request.intent.audience, protocolKeyIdentity: request.custody.protocolKeyIdentity,
                    algorithm: request.custody.algorithm, providerStatus: verified.providerStatus,
                    evidenceStatus: verified.evidenceStatus, providerDigest: verified.providerDigest,
                    evidenceDigest: verified.evidenceDigest,
                });
            } catch {
                return rejected('malformed_provider_evidence');
            }
            const envelopeDigest = digestValueOperationEnvelope(envelope);
            if (verified.boundEnvelopeDigest !== envelopeDigest) return rejected('envelope_digest_mismatch');

            // Conservative local containment only. Trusted verifier outcomes,
            // not this clock, decide evidence freshness and distributed replay.
            if (verified.localAuthorizationExpiresAtMs <= Date.now()) return rejected('expired_authorization');

            const capability = Object.freeze({
                kind: 'value-operation-authorization' as const,
                envelopeDigest,
                localExpiresAtMs: verified.localAuthorizationExpiresAtMs,
            });
            capabilityRegistry.set(capability, {
                gate: gateIdentity, envelopeDigest, localExpiresAtMs: verified.localAuthorizationExpiresAtMs,
                consumedStages: new Set(),
            });
            return Object.freeze({ kind: 'authorized', envelope, envelopeDigest, capability });
        },

        assertAuthorization(capability, expectedEnvelopeDigest) {
            assertRegisteredAuthorization(capability, expectedEnvelopeDigest);
        },

        assertAndConsumeStage(capability, stage, expectedEnvelopeDigest) {
            if (!['sign', 'broadcast', 'settle'].includes(stage)) {
                throw new ValueOperationAuthorizationError('mismatched_authorization');
            }
            const record = assertRegisteredAuthorization(capability, expectedEnvelopeDigest);
            if (record.consumedStages.has(stage)) {
                throw new ValueOperationAuthorizationError('consumed_authorization');
            }
            record.consumedStages.add(stage);
        },
    };
    return Object.freeze(gate);
}

/** Production gate with no verifier or clock injection surface. */
export function createValueOperationGate(): ValueOperationGate {
    return createGate();
}

export type {
    EvidenceVerificationRequest,
    EvidenceVerificationResult,
    VerifiedEvidenceBinding,
} from './value-operation-evidence-verifier';
