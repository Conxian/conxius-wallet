import { digestValueOperationEnvelope } from './value-operation-gate';
import { inspectAuthorizedValueOperation, type AuthorizedValueOperation } from './value-operations';
import {
    inspectSignerIssuedBitcoinBroadcastArtifact,
    type SignerIssuedBitcoinBroadcastArtifact,
} from './value-signer';

export interface AuthorizedBitcoinBroadcastRequest {
    readonly authorization: AuthorizedValueOperation;
    readonly artifact: SignerIssuedBitcoinBroadcastArtifact;
}

export type BitcoinBroadcastOutcome =
    | Readonly<{ kind: 'unsupported'; reason: 'qualified_provider_unavailable' }>
    | Readonly<{ kind: 'rejected'; reason:
        | 'invalid_broadcast_request'
        | 'forged_authorization'
        | 'mismatched_authorization'
        | 'expired_authorization'
        | 'forged_broadcast_artifact'
        | 'broadcast_digest_mismatch' }>;

/**
* Wallet-owned containment boundary. It requires the exact live authorization
* and the identity-registered signer artifact that records the authorized
* PSBT→final-transaction transition. Phase 2 has no qualified provider receipt,
* so it performs no network submission and does not consume the broadcast
* stage. A future qualified provider must consume that stage immediately before
* its irreversible I/O call.
*/
export async function broadcastAuthorizedBitcoinTransaction(
    request: AuthorizedBitcoinBroadcastRequest,
): Promise<BitcoinBroadcastOutcome> {
    if (typeof request !== 'object' || request === null || !request.authorization || !request.artifact) {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_broadcast_request' });
    }
    const { authorization, artifact } = request;
    try {
        if (
            authorization.kind !== 'authorized'
            || authorization.envelopeDigest !== authorization.capability.envelopeDigest
            || digestValueOperationEnvelope(authorization.envelope) !== authorization.envelopeDigest
            || authorization.envelope.canonicalOperationDigest !== artifact.sourceOperationDigest
        ) {
            return Object.freeze({ kind: 'rejected', reason: 'mismatched_authorization' });
        }
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'mismatched_authorization' });
    }
    const authorizationInspection = inspectAuthorizedValueOperation(authorization);
    if (authorizationInspection.kind === 'rejected') return authorizationInspection;
    const provenance = inspectSignerIssuedBitcoinBroadcastArtifact(authorization, artifact);
    if (provenance.kind === 'rejected') return provenance;
    return Object.freeze({ kind: 'unsupported', reason: 'qualified_provider_unavailable' });
}
