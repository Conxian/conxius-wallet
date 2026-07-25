import type {
  ValueOperationAuthorization,
  ValueOperationBroadcastAuthorization,
  ValueOperationRequest,
  ValueOperationSettlementAuthorization,
  ValueOperationSettlementSubmission,
} from '../value-operation';
import { digestValueOperationValue } from '../value-operation';

const issuedAuthorizations = new WeakSet<object>();
const consumedSignatureAuthorizations = new WeakSet<object>();

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

export function registerValueOperationAuthorization(authorization: ValueOperationAuthorization): void {
  issuedAuthorizations.add(authorization);
}

export function isRegisteredValueOperationAuthorization(authorization: ValueOperationAuthorization): boolean {
  return issuedAuthorizations.has(authorization);
}

export function consumeSignatureAuthorization(authorization: ValueOperationAuthorization): void {
  if (consumedSignatureAuthorizations.has(authorization)) {
    throw new Error('Allowed value operation authorization was already consumed.');
  }
  consumedSignatureAuthorizations.add(authorization);
}

export function issueBroadcastAuthorization(input: {
  signedHex: string;
  layer: string;
  network: string;
  expiresAt: number;
}): ValueOperationBroadcastAuthorization {
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
}

export function consumeBroadcastAuthorization(
  authorization: ValueOperationBroadcastAuthorization,
  submission: { signedHex: string; layer: string; network: string; now?: Date },
): void {
  const record = broadcastAuthorizations.get(authorization);
  if (!record) throw new Error('BROADCAST_AUTHORIZATION_INVALID: authorization was not issued by the wallet gate');
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
}

function settlementPayload(request: ValueOperationRequest): { provider: string; intent: unknown } | null {
  if (!request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload)) return null;
  const payload = request.payload as Record<string, unknown>;
  if (typeof payload.provider !== 'string' || !payload.provider || !('intent' in payload)) return null;
  return { provider: payload.provider, intent: payload.intent };
}

export function issueSettlementAuthorization(
  request: ValueOperationRequest,
  expiresAt: number,
): ValueOperationSettlementAuthorization | null {
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
}

export function assertSettlementAuthorizationMatchesRequest(
  authorization: ValueOperationSettlementAuthorization,
  request: ValueOperationRequest,
): void {
  const record = settlementAuthorizations.get(authorization);
  if (!record) throw new Error('SETTLEMENT_AUTHORIZATION_INVALID: authorization was not issued by the App-private gate');
  const payload = settlementPayload(request);
  if (!payload
    || record.requestIntentDigest !== request.intentDigest
    || record.layer !== request.chainLayer
    || record.network !== request.network
    || record.provider !== payload.provider
    || record.settlementIntentDigest !== digestValueOperationValue({ provider: payload.provider, intent: payload.intent })) {
    throw new Error('SETTLEMENT_AUTHORIZATION_REQUEST_MISMATCH: authorization does not match the requested settlement');
  }
}

export function consumeSettlementAuthorization(
  authorization: ValueOperationSettlementAuthorization,
  submission: ValueOperationSettlementSubmission,
): void {
  const record = settlementAuthorizations.get(authorization);
  if (!record) throw new Error('SETTLEMENT_AUTHORIZATION_INVALID: authorization was not issued by the App-private gate');
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
}
