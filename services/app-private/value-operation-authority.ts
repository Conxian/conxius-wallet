/**
* App-private production authority.
*
* App.tsx is the only allowed production importer. Repository architecture
* tests enforce that feature and service modules receive only the central
* queue requester callback and cannot construct a confirmer.
*/
import { Capacitor } from '@capacitor/core';
import { requestEnclaveSignature } from '../signer';
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
import {
  issueBroadcastAuthorization,
  issueSettlementAuthorization,
  registerValueOperationAuthorization,
} from './value-operation-capability-registry';

const consumedAuthorizations = new Set<string>();

function evaluateConfirmedValueOperation(
  request: ValueOperationRequest,
  options: { now?: Date; evidenceDecision?: ValueOperationEvidenceDecision },
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
  registerValueOperationAuthorization(authorization);
  return { status: 'allowed', authorization };
}

async function confirmValueOperation(
  request: ValueOperationRequest,
  vault: string | Uint8Array,
  options: { now?: Date } = {},
): Promise<ValueOperationOutcome> {
  const preflight = evaluateConfirmedValueOperation(request, { now: options.now });
  if (preflight.status !== 'quarantined' || preflight.code !== 'MISSING_AUTHORITATIVE_EVIDENCE') return preflight;

  const evidenceAdapter = getWalletEvidenceAdapter();
  if (!evidenceAdapter) return preflight;

  let evidenceDecision: ValueOperationEvidenceDecision;
  try {
    evidenceDecision = await evidenceAdapter.verify(createValueOperationEvidenceRequest(request));
  } catch {
    return createDeniedValueOperationOutcome('quarantined', 'EVIDENCE_ADAPTER_FAILED', 'Authoritative evidence verification was unavailable.');
  }

  const outcome = evaluateConfirmedValueOperation(request, { ...options, evidenceDecision });
  if (outcome.status !== 'allowed') return outcome;
  if (!Capacitor.isNativePlatform()) {
    return createDeniedValueOperationOutcome('unsupported', 'NATIVE_VALUE_SIGNER_REQUIRED', 'Production value operations require the native signer.', outcome.authorization.envelopeDigest);
  }

  const replayKey = `${outcome.authorization.audience}:${outcome.authorization.nonce}`;
  if (consumedAuthorizations.has(replayKey)) {
    return createDeniedValueOperationOutcome('rejected', 'REPLAY_DETECTED', 'This value-operation authorization was already consumed.', outcome.authorization.envelopeDigest);
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
      return createDeniedValueOperationOutcome('rejected', 'EMPTY_NATIVE_SIGNATURE', 'The native signer returned no authoritative signing result.', outcome.authorization.envelopeDigest);
    }

    const capabilityExpiresAt = Math.min(Date.parse(request.expiresAt), Date.now() + 60_000);
    const settlementAuthorization = issueSettlementAuthorization(request, capabilityExpiresAt);
    const broadcastAuthorization = signature.broadcastReadyHex
      ? issueBroadcastAuthorization({
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
}

export function createAppPrivateValueOperationAuthority(vault: string | Uint8Array): AppPrivateValueOperationAuthority {
  return Object.freeze({
    confirm: (request: ValueOperationRequest) => confirmValueOperation(request, vault),
    reject: (request: ValueOperationRequest) => createDeniedValueOperationOutcome(
      'rejected',
      'USER_REJECTED',
      'The user did not confirm the value operation.',
      digestValueOperationEnvelope(createValueOperationEnvelope(request)),
    ),
  });
}

export function resetAppPrivateValueOperationReplayCacheForTests(): void {
  consumedAuthorizations.clear();
}
