import { digestValueOperationEnvelope } from './value-operation-gate';
import {
    consumeAuthorizedValueOperationStage,
    inspectAuthorizedValueOperation,
    type AuthorizedValueOperation,
} from './value-operations';
import {
    validateSignedBitcoinValueOperationLineage,
    type SignedBitcoinLineageRejectionReason,
    type SignedBitcoinValueOperation,
} from './value-signer';

export interface BitcoinBroadcastRequest {
    readonly authorization: AuthorizedValueOperation;
    readonly signed: SignedBitcoinValueOperation;
}

export type BitcoinBroadcastOutcome =
    | Readonly<{ kind: 'unsupported'; reason: 'qualified_provider_unavailable' }>
    | Readonly<{ kind: 'rejected'; reason:
        | 'invalid_broadcast_request'
        | 'expired_authorization'
        | 'forged_authorization'
        | 'mismatched_authorization'
        | 'consumed_authorization'
        | SignedBitcoinLineageRejectionReason }>;

function isExactBroadcastRequest(value: unknown): value is BitcoinBroadcastRequest {
    if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
    const keys = Reflect.ownKeys(value);
    return keys.length === 2
        && keys.every((key) => typeof key === 'string')
        && Object.hasOwn(value, 'authorization')
        && Object.hasOwn(value, 'signed');
}

/**
* One-shot wallet-owned containment boundary. A fully validated request
* consumes the exact broadcast capability, then returns unsupported because
* no qualified provider exists. No network or provider call is performed.
*/
export async function broadcastAuthorizedBitcoinTransaction(
    request: BitcoinBroadcastRequest,
): Promise<BitcoinBroadcastOutcome> {
    if (!isExactBroadcastRequest(request)) {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_broadcast_request' });
    }
    const { authorization, signed } = request;
    try {
        if (
            authorization.kind !== 'authorized'
            || authorization.envelopeDigest !== authorization.capability.envelopeDigest
            || digestValueOperationEnvelope(authorization.envelope) !== authorization.envelopeDigest
        ) {
            return Object.freeze({ kind: 'rejected', reason: 'mismatched_authorization' });
        }
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'forged_authorization' });
    }

    const inspection = inspectAuthorizedValueOperation(authorization);
    if (inspection.kind === 'rejected') return inspection;

    const lineage = validateSignedBitcoinValueOperationLineage(authorization, signed);
    if (lineage.kind === 'rejected') return lineage;
    if (lineage.envelopeDigest !== authorization.envelopeDigest) {
        return Object.freeze({ kind: 'rejected', reason: 'mismatched_authorization' });
    }

    const consumed = consumeAuthorizedValueOperationStage(
        authorization,
        'broadcast',
        authorization.envelopeDigest,
    );
    if (consumed.kind === 'rejected') return consumed;
    return Object.freeze({ kind: 'unsupported', reason: 'qualified_provider_unavailable' });
}
