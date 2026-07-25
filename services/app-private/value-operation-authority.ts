/**
* App-private production authority.
*
* App.tsx is the only allowed production importer. Repository architecture
* tests enforce that feature and service modules receive only the central
* queue requester callback and cannot construct a confirmer.
*/
import { Capacitor } from '@capacitor/core';
import { signAuthorizedValueOperation } from './value-operation-signer';
import { getWalletEvidenceAdapter } from '../value-operation-evidence';
import {
  createDeniedValueOperationOutcome,
  createValueOperationEnvelope,
  createValueOperationEvidenceRequest,
  digestValueOperationEnvelope,
  type ValueOperationAuthorization,
  type ValueOperationEvidenceDecision,
  type ValueOperationOutcome,
  type ValueOperationRequest,
  validateValueOperationRequestIntegrity,
} from '../value-operation';
import { digestValueOperationValue } from '../value-operation';
import type { ValueOperationCapabilityConsumer } from '../value-operation-capability-consumer';

const replayCaches = new Set<Set<string>>();
const trustedConsumers = new WeakSet<object>();

/**
* Assert-only runtime provenance boundary for capability consumers.
* Registration remains module-private so callers cannot mint or bless one.
*/
export function assertTrustedValueOperationCapabilityConsumer(
  consumer: ValueOperationCapabilityConsumer | undefined,
): asserts consumer is ValueOperationCapabilityConsumer {
  if (!consumer || !trustedConsumers.has(consumer)) {
    throw new Error('VALUE_OPERATION_CONSUMER_UNTRUSTED: capability consumer was not created by the App-private authority');
  }
}

function authorizationMatchesRequest(
  authorization: ValueOperationAuthorization,
  request: ValueOperationRequest,
): boolean {
  const envelope = authorization.envelope;
  return validateValueOperationRequestIntegrity(request)
    && envelope.operationType === request.operationType
    && envelope.chainLayer === request.chainLayer
    && envelope.signingType === request.signingType
    && envelope.payloadDigest === request.payloadDigest
    && envelope.descriptionDigest === request.descriptionDigest
    && envelope.network === request.network
    && envelope.purpose === request.purpose
    && envelope.nonce === request.nonce
    && envelope.audience === request.audience
    && envelope.keyIdentity === request.keyIdentity
    && envelope.algorithm === request.algorithm
    && envelope.issuedAt === request.issuedAt
    && envelope.expiresAt === request.expiresAt;
}

function settlementPayload(request: ValueOperationRequest): { provider: string; intent: unknown } | null {
  if (!request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload)) return null;
  const payload = request.payload as Record<string, unknown>;
  if (typeof payload.provider !== 'string' || !payload.provider || !('intent' in payload)) return null;
  return { provider: payload.provider, intent: payload.intent };
}

function createAuthorityState() {
  const issuedAuthorizations = new WeakSet<object>();
  const consumedSignatureAuthorizations = new WeakSet<object>();
  const consumedAuthorizations = new Set<string>();
  const broadcastAuthorizations = new WeakMap<object, {
    signedHex: string;
    signedHexDigest: string;
    layer: string;
    network: string;
    expiresAt: number;
    consumed: boolean;
  }>();
  const settlementAuthorizations = new WeakMap<object, {
    requestIntentDigest: string;
    settlementIntentDigest: string;
    layer: string;
    provider: string;
    network: string;
    expiresAt: number;
    consumed: boolean;
  }>();
  replayCaches.add(consumedAuthorizations);

  const assertIssuedAuthorizationMatchesRequest = (
    authorization: ValueOperationAuthorization,
    request: ValueOperationRequest,
  ) => {
    if (!issuedAuthorizations.has(authorization)) {
      throw new Error('CAPABILITY_ISSUER_AUTHORIZATION_INVALID: outcome was not registered by this App-private authority');
    }
    if (!authorizationMatchesRequest(authorization, request)) {
      throw new Error('CAPABILITY_ISSUER_REQUEST_MISMATCH: registered outcome does not match the exact request');
    }
  };

  const issueBroadcastAuthorization = (input: {
    authorization: ValueOperationAuthorization;
    request: ValueOperationRequest;
    signedHex: string;
    layer: string;
    network: string;
    expiresAt: number;
  }) => {
    assertIssuedAuthorizationMatchesRequest(input.authorization, input.request);
    const authorization = Object.freeze({ kind: 'value-operation-broadcast-authorization' as const });
    broadcastAuthorizations.set(authorization, {
      signedHex: input.signedHex,
      signedHexDigest: digestValueOperationValue(input.signedHex),
      layer: input.layer,
      network: input.network,
      expiresAt: input.expiresAt,
      consumed: false,
    });
    return authorization;
  };

  const issueSettlementAuthorization = (
    gateAuthorization: ValueOperationAuthorization,
    request: ValueOperationRequest,
    expiresAt: number,
  ) => {
    assertIssuedAuthorizationMatchesRequest(gateAuthorization, request);
    if (request.operationType !== 'settle') return null;
    const payload = settlementPayload(request);
    if (!payload) return null;
    const authorization = Object.freeze({ kind: 'value-operation-settlement-authorization' as const });
    settlementAuthorizations.set(authorization, {
      requestIntentDigest: request.intentDigest,
      settlementIntentDigest: digestValueOperationValue({ provider: payload.provider, intent: payload.intent }),
      layer: request.chainLayer,
      provider: payload.provider,
      network: request.network,
      expiresAt,
      consumed: false,
    });
    return authorization;
  };

  const consumer: ValueOperationCapabilityConsumer = {
    isIssuedAuthorization: (authorization) => issuedAuthorizations.has(authorization),
    requireSignature: (outcome, request) => {
      if (outcome.status !== 'allowed') {
        throw Object.assign(new Error(`${outcome.code}: ${outcome.reason}`), { outcome });
      }
      if (!issuedAuthorizations.has(outcome.authorization)) {
        throw new Error('Allowed value operation authorization was not issued by this App-private authority.');
      }
      if (request && !authorizationMatchesRequest(outcome.authorization, request)) {
        throw new Error('Allowed value operation authorization does not match the service request.');
      }
      if (!outcome.signature) throw new Error('Allowed value operation is missing its native signature result.');
      if (consumedSignatureAuthorizations.has(outcome.authorization)) {
        throw new Error('Allowed value operation authorization was already consumed.');
      }
      consumedSignatureAuthorizations.add(outcome.authorization);
      return outcome.signature;
    },
    requireSettlementAuthorization: (outcome, request) => {
      if (outcome.status !== 'allowed') {
        throw Object.assign(new Error(`${outcome.code}: ${outcome.reason}`), { outcome });
      }
      if (!issuedAuthorizations.has(outcome.authorization)) {
        throw new Error('Allowed value operation authorization was not issued by this App-private authority.');
      }
      if (!authorizationMatchesRequest(outcome.authorization, request)) {
        throw new Error('Allowed value operation authorization does not match the service request.');
      }
      if (!outcome.settlementAuthorization) {
        throw new Error('Allowed value operation is missing its settlement authorization.');
      }
      const record = settlementAuthorizations.get(outcome.settlementAuthorization);
      const payload = settlementPayload(request);
      if (!record || !payload
        || record.requestIntentDigest !== request.intentDigest
        || record.layer !== request.chainLayer
        || record.network !== request.network
        || record.provider !== payload.provider
        || record.settlementIntentDigest !== digestValueOperationValue({ provider: payload.provider, intent: payload.intent })) {
        throw new Error('SETTLEMENT_AUTHORIZATION_REQUEST_MISMATCH: authorization does not match the requested settlement');
      }
      return outcome.settlementAuthorization;
    },
    consumeBroadcastAuthorization: (authorization, submission) => {
      const record = broadcastAuthorizations.get(authorization);
      if (!record) throw new Error('BROADCAST_AUTHORIZATION_INVALID: authorization was not issued by this App-private authority');
      const now = submission.now ?? new Date();
      if (record.consumed) throw new Error('BROADCAST_AUTHORIZATION_REPLAYED: authorization is one-time');
      if (now.getTime() >= record.expiresAt) throw new Error('BROADCAST_AUTHORIZATION_STALE: authorization expired');
      if (submission.layer !== record.layer || submission.network !== record.network) {
        throw new Error('BROADCAST_AUTHORIZATION_CONTEXT_MISMATCH: layer or network differs from authorization');
      }
      if (submission.signedHex !== record.signedHex
        || digestValueOperationValue(submission.signedHex) !== record.signedHexDigest) {
        throw new Error('BROADCAST_AUTHORIZATION_TRANSACTION_MISMATCH: signed transaction differs from authorization');
      }
      record.consumed = true;
    },
    consumeSettlementAuthorization: (submission) => {
      const record = settlementAuthorizations.get(submission.authorization);
      if (!record) throw new Error('SETTLEMENT_AUTHORIZATION_INVALID: authorization was not issued by this App-private authority');
      const now = submission.now ?? new Date();
      if (record.consumed) throw new Error('SETTLEMENT_AUTHORIZATION_REPLAYED: authorization is one-time');
      if (now.getTime() >= record.expiresAt) throw new Error('SETTLEMENT_AUTHORIZATION_STALE: authorization expired');
      if (submission.layer !== record.layer || submission.network !== record.network || submission.provider !== record.provider) {
        throw new Error('SETTLEMENT_AUTHORIZATION_CONTEXT_MISMATCH: layer, provider, or network differs from authorization');
      }
      if (digestValueOperationValue({ provider: submission.provider, intent: submission.intent }) !== record.settlementIntentDigest) {
        throw new Error('SETTLEMENT_AUTHORIZATION_INTENT_MISMATCH: payment intent differs from authorization');
      }
      record.consumed = true;
    },
  };
  Object.freeze(consumer);
  trustedConsumers.add(consumer);

  return {
    consumedAuthorizations,
    consumer,
    issueBroadcastAuthorization,
    issueSettlementAuthorization,
    registerAuthorization: (authorization: ValueOperationAuthorization) => issuedAuthorizations.add(authorization),
  };
}

function evaluateConfirmedValueOperation(
  request: ValueOperationRequest,
  options: { now?: Date; evidenceDecision?: ValueOperationEvidenceDecision },
  registerAuthorization: (authorization: ValueOperationAuthorization) => void,
): ValueOperationOutcome {
  const now = options.now ?? new Date();
  const envelope = createValueOperationEnvelope(request, options.evidenceDecision);
  const envelopeDigest = digestValueOperationEnvelope(envelope);

  if (!validateValueOperationRequestIntegrity(request)) {
    return createDeniedValueOperationOutcome('rejected', 'REQUEST_MUTATION_DETECTED', 'The signable request no longer matches its canonical binding.', envelopeDigest);
  }
  if (!request.nonce || !request.audience || !request.keyIdentity || !request.algorithm) {
    return createDeniedValueOperationOutcome('rejected', 'MALFORMED_ENVELOPE', 'Required request-binding fields are missing.', envelopeDigest);
  }

  const issuedAt = Date.parse(request.issuedAt);
  const expiresAt = Date.parse(request.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt > expiresAt) {
    return createDeniedValueOperationOutcome('rejected', 'MALFORMED_ENVELOPE_TIME', 'Envelope time bounds are malformed.', envelopeDigest);
  }
  if (now.getTime() < issuedAt || now.getTime() >= expiresAt) {
    return createDeniedValueOperationOutcome('quarantined', 'STALE_ENVELOPE', 'The value-operation envelope is not currently valid.', envelopeDigest);
  }

  const decision = options.evidenceDecision;
  if (!decision) return createDeniedValueOperationOutcome('quarantined', 'MISSING_AUTHORITATIVE_EVIDENCE', 'Authoritative provider evidence is required.', envelopeDigest);
  if (decision.status !== 'verified' || decision.providerStatus !== 'authoritative') {
    const status = decision.status === 'unsupported' || decision.providerStatus === 'unsupported'
      ? 'unsupported' : decision.status === 'non-authoritative' ? 'simulated' : 'quarantined';
    return createDeniedValueOperationOutcome(status, decision.code, decision.reason, envelopeDigest);
  }

  const evidenceIssuedAt = Date.parse(decision.issuedAt);
  const evidenceExpiresAt = Date.parse(decision.expiresAt);
  if (!Number.isFinite(evidenceIssuedAt) || !Number.isFinite(evidenceExpiresAt)
    || now.getTime() < evidenceIssuedAt || now.getTime() >= evidenceExpiresAt) {
    return createDeniedValueOperationOutcome('quarantined', 'STALE_EVIDENCE', 'Provider evidence is stale or malformed.', envelopeDigest);
  }
  if (decision.requestDigest !== request.intentDigest || decision.nonce !== request.nonce
    || decision.audience !== request.audience || decision.keyIdentity !== request.keyIdentity
    || decision.algorithm !== request.algorithm) {
    return createDeniedValueOperationOutcome('rejected', 'EVIDENCE_REQUEST_MISMATCH', 'Evidence is not bound to this exact operation request.', envelopeDigest);
  }

  const frozenEnvelope = Object.freeze({
    ...envelope,
    evidenceDigests: Object.freeze([...envelope.evidenceDigests]),
  });
  const authorization: ValueOperationAuthorization = Object.freeze({
    kind: 'value-operation-authorization', envelope: frozenEnvelope, envelopeDigest,
    nonce: request.nonce, audience: request.audience,
    authorizedAt: now.toISOString(), expiresAt: request.expiresAt,
  });
  registerAuthorization(authorization);
  return { status: 'allowed', authorization };
}

async function confirmValueOperation(
  request: ValueOperationRequest,
  vault: string,
  state: ReturnType<typeof createAuthorityState>,
  options: { now?: Date } = {},
): Promise<ValueOperationOutcome> {
  const preflight = evaluateConfirmedValueOperation(request, { now: options.now }, state.registerAuthorization);
  if (preflight.status !== 'quarantined' || preflight.code !== 'MISSING_AUTHORITATIVE_EVIDENCE') return preflight;

  const evidenceAdapter = getWalletEvidenceAdapter();
  if (!evidenceAdapter) return preflight;

  let evidenceDecision: ValueOperationEvidenceDecision;
  try {
    evidenceDecision = await evidenceAdapter.verify(createValueOperationEvidenceRequest(request));
  } catch {
    return createDeniedValueOperationOutcome('quarantined', 'EVIDENCE_ADAPTER_FAILED', 'Authoritative evidence verification was unavailable.');
  }

  const outcome = evaluateConfirmedValueOperation(request, { ...options, evidenceDecision }, state.registerAuthorization);
  if (outcome.status !== 'allowed') return outcome;
  if (!Capacitor.isNativePlatform()) {
    return createDeniedValueOperationOutcome('unsupported', 'NATIVE_VALUE_SIGNER_REQUIRED', 'Production value operations require the native signer.', outcome.authorization.envelopeDigest);
  }

  const replayKey = `${outcome.authorization.audience}:${outcome.authorization.nonce}`;
  if (state.consumedAuthorizations.has(replayKey)) {
    return createDeniedValueOperationOutcome('rejected', 'REPLAY_DETECTED', 'This value-operation authorization was already consumed.', outcome.authorization.envelopeDigest);
  }
  state.consumedAuthorizations.add(replayKey);

  try {
    const signature = await signAuthorizedValueOperation({
      type: request.signingType,
      layer: request.chainLayer,
      payload: request.payload,
      description: request.description,
    }, vault);
    if (!signature.signature && !signature.broadcastReadyHex) {
      return createDeniedValueOperationOutcome('rejected', 'EMPTY_NATIVE_SIGNATURE', 'The native signer returned no authoritative signing result.', outcome.authorization.envelopeDigest);
    }

    const capabilityExpiresAt = Math.min(Date.parse(request.expiresAt), Date.now() + 60_000);
    const settlementAuthorization = state.issueSettlementAuthorization(outcome.authorization, request, capabilityExpiresAt);
    const broadcastAuthorization = signature.broadcastReadyHex
      ? state.issueBroadcastAuthorization({
          authorization: outcome.authorization,
          request,
          signedHex: signature.broadcastReadyHex,
          layer: request.chainLayer,
          network: request.network,
          expiresAt: capabilityExpiresAt,
        })
      : undefined;
    return { ...outcome, signature, broadcastAuthorization, settlementAuthorization: settlementAuthorization ?? undefined };
  } catch {
    return createDeniedValueOperationOutcome('rejected', 'NATIVE_SIGNING_FAILED', 'The native signer rejected or failed the value operation.', outcome.authorization.envelopeDigest);
  }
}

export interface AppPrivateValueOperationAuthority {
  confirm(request: ValueOperationRequest): Promise<ValueOperationOutcome>;
  reject(request: ValueOperationRequest): ValueOperationOutcome;
  readonly consumer: ValueOperationCapabilityConsumer;
}

export function createAppPrivateValueOperationAuthority(vault: string): AppPrivateValueOperationAuthority {
  const state = createAuthorityState();
  return Object.freeze({
    confirm: (request: ValueOperationRequest) => confirmValueOperation(request, vault, state),
    reject: (request: ValueOperationRequest) => createDeniedValueOperationOutcome(
      'rejected',
      'USER_REJECTED',
      'The user did not confirm the value operation.',
      digestValueOperationEnvelope(createValueOperationEnvelope(request)),
    ),
    consumer: state.consumer,
  });
}

export function resetAppPrivateValueOperationReplayCacheForTests(): void {
  replayCaches.forEach((cache) => cache.clear());
}
