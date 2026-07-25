import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { SignRequest, SignResult } from './signer';
import {
  assertSettlementAuthorizationMatchesRequest,
  consumeBroadcastAuthorization,
  consumeSettlementAuthorization,
  consumeSignatureAuthorization,
  isRegisteredValueOperationAuthorization,
} from './app-private/value-operation-capability-registry';

export const VALUE_OPERATION_VERSION = 'conxius.value-operation.v1' as const;

export type ValueOperationType = 'sign' | 'send' | 'transfer' | 'broadcast' | 'bridge' | 'settle' | 'withdraw';
export type ValueOperationProviderStatus = 'authoritative' | 'non-authoritative' | 'missing' | 'unsupported';
export type ValueOperationEvidenceStatus =
  | 'verified' | 'missing' | 'stale' | 'malformed' | 'revoked'
  | 'mismatched' | 'unsupported' | 'non-authoritative';

export interface ValueOperationEnvelope {
  version: typeof VALUE_OPERATION_VERSION;
  operationType: ValueOperationType;
  chainLayer: string;
  signingType: SignRequest['type'];
  payloadDigest: string;
  descriptionDigest: string;
  network: string;
  purpose: string;
  nonce: string;
  audience: string;
  keyIdentity: string;
  algorithm: string;
  providerStatus: ValueOperationProviderStatus;
  evidenceStatus: ValueOperationEvidenceStatus;
  evidenceDigests: readonly string[];
  issuedAt: string;
  expiresAt: string;
}

export interface ValueOperationRequest {
  readonly operationType: ValueOperationType;
  readonly chainLayer: string;
  readonly payload: unknown;
  readonly payloadDigest: string;
  readonly network: string;
  readonly purpose: string;
  readonly nonce: string;
  readonly audience: string;
  readonly keyIdentity: string;
  readonly algorithm: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly signingType: SignRequest['type'];
  readonly description: string;
  readonly descriptionDigest: string;
  readonly intentDigest: string;
}

export interface ValueOperationEvidenceRequest {
  version: typeof VALUE_OPERATION_VERSION;
  requestDigest: string;
  operationType: ValueOperationType;
  chainLayer: string;
  payloadDigest: string;
  network: string;
  purpose: string;
  nonce: string;
  audience: string;
  keyIdentity: string;
  algorithm: string;
  issuedAt: string;
  expiresAt: string;
}

export type ValueOperationEvidenceDecision =
  | {
      status: 'verified';
      provider: string;
      providerStatus: 'authoritative';
      requestDigest: string;
      nonce: string;
      audience: string;
      keyIdentity: string;
      algorithm: string;
      evidenceDigests: readonly string[];
      issuedAt: string;
      expiresAt: string;
    }
  | {
      status: Exclude<ValueOperationEvidenceStatus, 'verified'>;
      providerStatus: Exclude<ValueOperationProviderStatus, 'authoritative'>;
      code: string;
      reason: string;
      evidenceDigests?: readonly string[];
    };

/** Trusted seam: only an external verifier adapter may produce evidence decisions. */
export interface ValueOperationEvidenceAdapter {
  verify(request: ValueOperationEvidenceRequest): Promise<ValueOperationEvidenceDecision>;
}

export interface ValueOperationAuthorization {
  kind: 'value-operation-authorization';
  envelope: ValueOperationEnvelope;
  envelopeDigest: string;
  nonce: string;
  audience: string;
  authorizedAt: string;
  expiresAt: string;
}

export interface ValueOperationBroadcastAuthorization {
  readonly kind: 'value-operation-broadcast-authorization';
}

export interface ValueOperationSettlementAuthorization {
  readonly kind: 'value-operation-settlement-authorization';
}

export interface ValueOperationSettlementSubmission {
  authorization: ValueOperationSettlementAuthorization;
  layer: string;
  provider: string;
  network: string;
  intent: unknown;
  now?: Date;
}

type DeniedStatus = 'rejected' | 'quarantined' | 'simulated' | 'unsupported';
export type ValueOperationOutcome =
  | {
      status: 'allowed';
      authorization: ValueOperationAuthorization;
      signature?: SignResult;
      broadcastAuthorization?: ValueOperationBroadcastAuthorization;
      settlementAuthorization?: ValueOperationSettlementAuthorization;
    }
  | { status: DeniedStatus; code: string; reason: string; envelopeDigest?: string };

export interface CreateValueOperationRequestInput {
  operationType: ValueOperationType;
  chainLayer: string;
  payload: unknown;
  network: string;
  purpose: string;
  nonce: string;
  audience: string;
  keyIdentity: string;
  algorithm: string;
  issuedAt: string;
  expiresAt: string;
  signingType: SignRequest['type'];
  description: string;
}

export type CreateUnverifiedValueOperationRequestInput = Omit<CreateValueOperationRequestInput, 'issuedAt' | 'expiresAt'> & {
  now?: Date;
  ttlMs?: number;
};

const encoder = new TextEncoder();
export function createValueOperationNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function assertCanonicalJson(value: unknown, path = '$'): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number at ${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCanonicalJson(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) throw new Error(`Undefined value at ${path}.${key}`);
      assertCanonicalJson(item, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`Unsupported canonical value at ${path}`);
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeCanonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort()
      .map((key) => [key, normalizeCanonicalValue((value as Record<string, unknown>)[key])]));
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function canonicalizeValueOperation(value: unknown): string {
  assertCanonicalJson(value);
  return JSON.stringify(normalizeCanonicalValue(value));
}

export function digestValueOperationValue(value: unknown): string {
  return bytesToHex(sha256(encoder.encode(canonicalizeValueOperation(value))));
}

export function digestValueOperationEnvelope(envelope: ValueOperationEnvelope): string {
  return digestValueOperationValue({ domain: VALUE_OPERATION_VERSION, envelope });
}

function requestIntentFields(input: CreateValueOperationRequestInput) {
  return {
    version: VALUE_OPERATION_VERSION,
    operationType: input.operationType,
    chainLayer: input.chainLayer,
    signingType: input.signingType,
    payloadDigest: digestValueOperationValue(input.payload),
    descriptionDigest: digestValueOperationValue(input.description),
    network: input.network,
    purpose: input.purpose,
    nonce: input.nonce,
    audience: input.audience,
    keyIdentity: input.keyIdentity,
    algorithm: input.algorithm,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  };
}

export function createValueOperationRequest(input: CreateValueOperationRequestInput): ValueOperationRequest {
  const canonicalPayload = JSON.parse(canonicalizeValueOperation(input.payload)) as unknown;
  const fields = requestIntentFields({ ...input, payload: canonicalPayload });
  return deepFreeze({
    ...input,
    payload: deepFreeze(canonicalPayload),
    payloadDigest: fields.payloadDigest,
    descriptionDigest: fields.descriptionDigest,
    intentDigest: digestValueOperationValue({ domain: `${VALUE_OPERATION_VERSION}.intent`, request: fields }),
  });
}

export function createUnverifiedValueOperationRequest(input: CreateUnverifiedValueOperationRequestInput): ValueOperationRequest {
  const now = input.now ?? new Date();
  return createValueOperationRequest({
    ...input,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (input.ttlMs ?? 5 * 60_000)).toISOString(),
  });
}

export function createDeniedValueOperationOutcome(status: DeniedStatus, code: string, reason: string, envelopeDigest?: string): ValueOperationOutcome {
  return { status, code, reason, envelopeDigest };
}

export function createValueOperationEnvelope(request: ValueOperationRequest, decision?: ValueOperationEvidenceDecision): ValueOperationEnvelope {
  return {
    version: VALUE_OPERATION_VERSION,
    operationType: request.operationType,
    chainLayer: request.chainLayer,
    signingType: request.signingType,
    payloadDigest: request.payloadDigest,
    descriptionDigest: request.descriptionDigest,
    network: request.network,
    purpose: request.purpose,
    nonce: request.nonce,
    audience: request.audience,
    keyIdentity: request.keyIdentity,
    algorithm: request.algorithm,
    providerStatus: decision?.providerStatus ?? 'missing',
    evidenceStatus: decision?.status ?? 'missing',
    evidenceDigests: [...(decision?.evidenceDigests ?? [])].sort(),
    issuedAt: request.issuedAt,
    expiresAt: request.expiresAt,
  };
}

export function createValueOperationEvidenceRequest(request: ValueOperationRequest): ValueOperationEvidenceRequest {
  return {
    version: VALUE_OPERATION_VERSION,
    requestDigest: request.intentDigest,
    operationType: request.operationType,
    chainLayer: request.chainLayer,
    payloadDigest: request.payloadDigest,
    network: request.network,
    purpose: request.purpose,
    nonce: request.nonce,
    audience: request.audience,
    keyIdentity: request.keyIdentity,
    algorithm: request.algorithm,
    issuedAt: request.issuedAt,
    expiresAt: request.expiresAt,
  };
}

export function validateValueOperationRequestIntegrity(request: ValueOperationRequest): boolean {
  const fields = requestIntentFields(request);
  return request.payloadDigest === fields.payloadDigest
    && request.descriptionDigest === fields.descriptionDigest
    && request.intentDigest === digestValueOperationValue({ domain: `${VALUE_OPERATION_VERSION}.intent`, request: fields });
}

export interface ValueOperationAuthorizer {
  (request: ValueOperationRequest): Promise<ValueOperationOutcome>;
}

export function consumeValueOperationBroadcastAuthorization(
  authorization: ValueOperationBroadcastAuthorization,
  submission: { signedHex: string; layer: string; network: string; now?: Date },
): void {
  consumeBroadcastAuthorization(authorization, submission);
}

export function consumeValueOperationSettlementAuthorization(submission: ValueOperationSettlementSubmission): void {
  consumeSettlementAuthorization(submission.authorization, submission);
}

export function valueOperationOutcomeMessage(outcome: ValueOperationOutcome): string {
  return outcome.status === 'allowed' ? 'Value operation authorized.' : `${outcome.code}: ${outcome.reason}`;
}

export class ValueOperationDeniedError extends Error {
  readonly outcome: Exclude<ValueOperationOutcome, { status: 'allowed' }>;
  constructor(outcome: Exclude<ValueOperationOutcome, { status: 'allowed' }>) {
    super(valueOperationOutcomeMessage(outcome));
    this.name = 'ValueOperationDeniedError';
    this.outcome = outcome;
  }
}

export function requireValueOperationSignature(
  outcome: ValueOperationOutcome,
  request?: ValueOperationRequest,
): SignResult {
  if (outcome.status !== 'allowed') throw new ValueOperationDeniedError(outcome);
  if (!isRegisteredValueOperationAuthorization(outcome.authorization)) {
    throw new Error('Allowed value operation authorization was not issued by the wallet gate.');
  }
  if (request) {
    const envelope = outcome.authorization.envelope;
    if (!validateValueOperationRequestIntegrity(request)
      || envelope.operationType !== request.operationType
      || envelope.chainLayer !== request.chainLayer
      || envelope.signingType !== request.signingType
      || envelope.payloadDigest !== request.payloadDigest
      || envelope.descriptionDigest !== request.descriptionDigest
      || envelope.network !== request.network
      || envelope.purpose !== request.purpose
      || envelope.nonce !== request.nonce
      || envelope.audience !== request.audience
      || envelope.keyIdentity !== request.keyIdentity
      || envelope.algorithm !== request.algorithm
      || envelope.issuedAt !== request.issuedAt
      || envelope.expiresAt !== request.expiresAt) {
      throw new Error('Allowed value operation authorization does not match the service request.');
    }
  }
  if (!outcome.signature) throw new Error('Allowed value operation is missing its native signature result.');
  consumeSignatureAuthorization(outcome.authorization);
  return outcome.signature;
}

export function requireValueOperationSettlementAuthorization(
  outcome: ValueOperationOutcome,
  request: ValueOperationRequest,
): ValueOperationSettlementAuthorization {
  if (outcome.status !== 'allowed') throw new ValueOperationDeniedError(outcome);
  if (!isRegisteredValueOperationAuthorization(outcome.authorization)) {
    throw new Error('Allowed value operation authorization was not issued by the App-private gate.');
  }
  if (!outcome.settlementAuthorization) {
    throw new Error('Allowed value operation is missing its settlement authorization.');
  }
  assertSettlementAuthorizationMatchesRequest(outcome.settlementAuthorization, request);
  return outcome.settlementAuthorization;
}

export async function authorizeValueOperationSettlement(
  authorize: ValueOperationAuthorizer,
  request: ValueOperationRequest,
): Promise<ValueOperationSettlementAuthorization> {
  return requireValueOperationSettlementAuthorization(await authorize(request), request);
}

export async function authorizeValueOperationSignature(
  authorize: ValueOperationAuthorizer,
  request: ValueOperationRequest,
): Promise<SignResult> {
  return requireValueOperationSignature(await authorize(request), request);
}

export function resetValueOperationReplayCacheForTests(): void {
  // Capability registries are WeakMap/WeakSet-backed and intentionally cannot
  // be converted into constructible test hooks. Authority replay state has an
  // explicit test-only reset in the App-private authority module.
}
