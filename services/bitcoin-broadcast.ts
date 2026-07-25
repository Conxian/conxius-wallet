import { digestCanonicalPayload } from './value-operation-gate';

export interface BitcoinBroadcastArtifact {
    readonly kind: 'bitcoin-transaction';
    readonly transactionHex: string;
    readonly digest: string;
}

export type BitcoinBroadcastOutcome =
    | Readonly<{ kind: 'unsupported'; reason: 'qualified_provider_unavailable' }>
    | Readonly<{ kind: 'rejected'; reason: 'invalid_broadcast_artifact' | 'broadcast_digest_mismatch' }>;

const HEX_PATTERN = /^[0-9a-f]+$/;

export function createBitcoinBroadcastArtifact(transactionHex: string): BitcoinBroadcastArtifact {
    const normalized = transactionHex.trim().toLowerCase();
    if (!normalized || normalized.length % 2 !== 0 || !HEX_PATTERN.test(normalized)) {
        throw new Error('Invalid Bitcoin transaction artifact.');
    }
    const payload = Object.freeze({ kind: 'bitcoin-transaction' as const, transactionHex: normalized });
    return Object.freeze({ ...payload, digest: digestCanonicalPayload(payload) });
}

/**
* Wallet-owned containment boundary. The artifact digest is checked exactly,
* but phase 2 has no qualified provider receipt and therefore performs no
* network submission and consumes no broadcast authorization stage.
*/
export async function broadcastAuthorizedBitcoinTransaction(
    artifact: BitcoinBroadcastArtifact,
): Promise<BitcoinBroadcastOutcome> {
    let expected: BitcoinBroadcastArtifact;
    try {
        expected = createBitcoinBroadcastArtifact(artifact.transactionHex);
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_broadcast_artifact' });
    }
    if (artifact.kind !== expected.kind || artifact.digest !== expected.digest) {
        return Object.freeze({ kind: 'rejected', reason: 'broadcast_digest_mismatch' });
    }
    return Object.freeze({ kind: 'unsupported', reason: 'qualified_provider_unavailable' });
}
