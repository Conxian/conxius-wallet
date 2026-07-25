import { endpointsFor, fetchWithRetry } from './network';
import { Network, Asset } from '../types';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import { knownUnsupportedValueOperation, type AuthorizedValueOperationExecution, type ValueOperationExecutionOutcome } from './value-operation-result';

export interface MavenAsset extends Asset {
    mavenId: string;
}

export interface MavenTransferArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.maven-transfer.v1'; readonly chain: 'bitcoin'; readonly layer: 'maven';
    readonly operation: 'transfer-asset'; readonly network: Network; readonly assetId: string;
    readonly amount: string; readonly recipient: string; readonly authorityCommitment: string;
    readonly sequencerConfigurationDigest: string;
}
export type MavenTransferRequest = AuthorizedValueOperationExecution<MavenTransferArtifact>;
const MAVEN_SEQUENCER_CONFIGURATION_DIGEST = digestCanonicalPayload(Object.freeze({ kind: 'conxius.wallet.unqualified-maven-sequencer.v1' }));

export function createMavenTransferArtifact(fields: {
    assetId: string; amount: string; recipient: string; authorityCommitment: string; network?: Network;
}): MavenTransferArtifact {
    const amount = fields.amount.trim();
    if (!fields.assetId.trim() || !/^(0|[1-9][0-9]*)$/.test(amount) || !fields.recipient.trim() || !fields.authorityCommitment.trim()) {
        throw new Error('Invalid Maven transfer request.');
    }
    return Object.freeze({
        kind: 'conxius.wallet.maven-transfer.v1', chain: 'bitcoin', layer: 'maven', operation: 'transfer-asset',
        network: fields.network ?? 'mainnet', assetId: fields.assetId.trim(), amount, recipient: fields.recipient.trim(),
        authorityCommitment: fields.authorityCommitment.trim(), sequencerConfigurationDigest: MAVEN_SEQUENCER_CONFIGURATION_DIGEST,
    });
}

/**
 * Maven Protocol Service (M6 Implementation)
 * Integrated L2 for asset issuance and fast transfers.
 */

/**
 * Fetches all assets for a given address on the Maven protocol.
 */
export const fetchMavenAssets = async (address: string, network: Network = 'mainnet'): Promise<Asset[]> => {
    try {
        const { MAVEN_API } = endpointsFor(network);
        if (!MAVEN_API) return [];

        const response = await fetchWithRetry(`${MAVEN_API}/v1/address/${address}/assets`, {}, 1, 1000);
        if (!response.ok) return [];

        const data = await response.json();
        return (data.assets || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            symbol: a.symbol,
            balance: a.balance,
            valueUsd: a.valueUsd || 0,
            layer: 'Maven',
            type: 'Native',
            address
        }));
    } catch (e) {
        console.warn('[Maven] Fetch failed', e);
        return [];
    }
};

/**
 * Prepares and signs a Maven asset transfer.
 */
export const createMavenTransfer = async (request: MavenTransferRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.maven-transfer.v1', operationType: 'transfer-asset', layer: 'maven', chain: 'bitcoin',
    });
