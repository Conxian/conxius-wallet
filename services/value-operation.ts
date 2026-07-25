import { Capacitor } from '@capacitor/core';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { requestEnclaveSignature, SignRequest, SignResult } from './signer';

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

type DeniedStatus = 'rejected' | 'quarantined' | 'simulated' | 'unsupported';
export type ValueOperationOutcome =
  | { status: 'allowed'; authorization: ValueOperationAuthorization; signature?: SignResult }
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
const consumedAuthorizations = new Set<string>();

function getWalletEvidenceAdapter(): ValueOperationEvidenceAdapter | null {
  // Intentionally unwired until the wallet has an authenticated external
  // verifier client. Feature callers cannot inject or self-assert authority.
  return null;
}

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

function denied(status: DeniedStatus, code: string, reason: string, envelopeDigest?: string): ValueOperationOutcome {
  return { status, code, reason, envelopeDigest };
}

function createEnvelope(request: ValueOperationRequest, decision?: ValueOperationEvidenceDecision): ValueOperationEnvelope {
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

function evidenceRequest(request: ValueOperationRequest): ValueOperationEvidenceRequest {
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

function validateRequestIntegrity(request: ValueOperationRequest): boolean {
  const fields = requestIntentFields(request);
  return request.payloadDigest === fields.payloadDigest
    && request.descriptionDigest === fields.descriptionDigest
    && request.intentDigest === digestValueOperationValue({ domain: `${VALUE_OPERATION_VERSION}.intent`, request: fields });
}

export function evaluateValueOperation(
  request: ValueOperationRequest,
  options: { userConfirmed: boolean; now?: Date; evidenceDecision?: ValueOperationEvidenceDecision },
): ValueOperationOutcome {
  const now = options.now ?? new Date();
  const envelope = createEnvelope(request, options.evidenceDecision);
  const envelopeDigest = digestValueOperationEnvelope(envelope);

  if (!validateRequestIntegrity(request)) {
    return denied('rejected', 'REQUEST_MUTATION_DETECTED', 'The signable request no longer matches its canonical binding.', envelopeDigest);
  }
  if (!options.userConfirmed) return denied('rejected', 'USER_REJECTED', 'The user did not confirm the value operation.', envelopeDigest);
  if (!request.nonce || !request.audience || !request.keyIdentity || !request.algorithm) {
    return denied('rejected', 'MALFORMED_ENVELOPE', 'Required request-binding fields are missing.', envelopeDigest);
  }

  const issuedAt = Date.parse(request.issuedAt);
  const expiresAt = Date.parse(request.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt > expiresAt) {
    return denied('rejected', 'MALFORMED_ENVELOPE_TIME', 'Envelope time bounds are malformed.', envelopeDigest);
  }
  if (now.getTime() < issuedAt || now.getTime() >= expiresAt) {
    return denied('quarantined', 'STALE_ENVELOPE', 'The value-operation envelope is not currently valid.', envelopeDigest);
  }

  const decision = options.evidenceDecision;
  if (!decision) return denied('quarantined', 'MISSING_AUTHORITATIVE_EVIDENCE', 'Authoritative provider evidence is required.', envelopeDigest);
  if (decision.status !== 'verified' || decision.providerStatus !== 'authoritative') {
    const status = decision.status === 'unsupported' || decision.providerStatus === 'unsupported'
      ? 'unsupported' : decision.status === 'non-authoritative' ? 'simulated' : 'quarantined';
    return denied(status, decision.code, decision.reason, envelopeDigest);
  }

  const evidenceIssuedAt = Date.parse(decision.issuedAt);
  const evidenceExpiresAt = Date.parse(decision.expiresAt);
  if (!Number.isFinite(evidenceIssuedAt) || !Number.isFinite(evidenceExpiresAt)
    || now.getTime() < evidenceIssuedAt || now.getTime() >= evidenceExpiresAt) {
    return denied('quarantined', 'STALE_EVIDENCE', 'Provider evidence is stale or malformed.', envelopeDigest);
  }
  if (decision.requestDigest !== request.intentDigest || decision.nonce !== request.nonce
    || decision.audience !== request.audience || decision.keyIdentity !== request.keyIdentity
    || decision.algorithm !== request.algorithm) {
    return denied('rejected', 'EVIDENCE_REQUEST_MISMATCH', 'Evidence is not bound to this exact operation request.', envelopeDigest);
  }

  return {
    status: 'allowed',
    authorization: {
      kind: 'value-operation-authorization', envelope, envelopeDigest,
      nonce: request.nonce, audience: request.audience,
      authorizedAt: now.toISOString(), expiresAt: request.expiresAt,
    },
  };
}

export async function executeValueOperation(
  request: ValueOperationRequest,
  vault: string | Uint8Array,
  options: { userConfirmed: boolean; now?: Date },
): Promise<ValueOperationOutcome> {
  const preflight = evaluateValueOperation(request, { userConfirmed: options.userConfirmed, now: options.now });
  if (preflight.status !== 'quarantined' || preflight.code !== 'MISSING_AUTHORITATIVE_EVIDENCE') {
    return preflight;
  }

  const evidenceAdapter = getWalletEvidenceAdapter();
  if (!evidenceAdapter) return preflight;

  let evidenceDecision: ValueOperationEvidenceDecision;
  try {
    evidenceDecision = await evidenceAdapter.verify(evidenceRequest(request));
  } catch {
    return denied('quarantined', 'EVIDENCE_ADAPTER_FAILED', 'Authoritative evidence verification was unavailable.');
  }

  const outcome = evaluateValueOperation(request, { ...options, evidenceDecision });
  if (outcome.status !== 'allowed') return outcome;
  if (!Capacitor.isNativePlatform()) {
    return denied('unsupported', 'NATIVE_VALUE_SIGNER_REQUIRED', 'Production value operations require the native signer.', outcome.authorization.envelopeDigest);
  }

  const replayKey = `${outcome.authorization.audience}:${outcome.authorization.nonce}`;
  if (consumedAuthorizations.has(replayKey)) {
    return denied('rejected', 'REPLAY_DETECTED', 'This value-operation authorization was already consumed.', outcome.authorization.envelopeDigest);
  }
  consumedAuthorizations.add(replayKey);

  try {
    const signature = await requestEnclaveSignature({
      type: request.signingType,
      layer: request.chainLayer,
      payload: request.payload,
      description: request.description,
    }, vault);
    if (!signature.signature && !signature.broadcastReadyHex) {
      return denied('rejected', 'EMPTY_NATIVE_SIGNATURE', 'The native signer returned no authoritative signing result.', outcome.authorization.envelopeDigest);
    }
    return { ...outcome, signature };
  } catch {
    return denied('rejected', 'NATIVE_SIGNING_FAILED', 'The native signer rejected or failed the value operation.', outcome.authorization.envelopeDigest);
  }
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

export function requireValueOperationSignature(outcome: ValueOperationOutcome): SignResult {
  if (outcome.status !== 'allowed') throw new ValueOperationDeniedError(outcome);
  if (!outcome.signature) throw new Error('Allowed value operation is missing its native signature result.');
  return outcome.signature;
}

export function resetValueOperationReplayCacheForTests(): void {
  consumedAuthorizations.clear();
}
