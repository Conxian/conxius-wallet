import { type Network } from '../types';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import { knownUnsupportedValueOperation, type AuthorizedValueOperationExecution, type ValueOperationExecutionOutcome } from './value-operation-result';

export interface TaprootAsset { id: string; name: string; symbol: string; totalSupply: bigint; meta: string; genesisPoint: string; }
export interface TaprootTransfer { assetId: string; amount: bigint; recipientAddr: string; }
export interface TaprootAssetTransferArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.taproot-assets-transfer.v1'; readonly chain: 'bitcoin'; readonly layer: 'taproot-assets';
    readonly operation: 'transfer-asset'; readonly network: Network; readonly assetId: string; readonly amount: string;
    readonly recipient: string; readonly virtualTransactionCommitment: string; readonly inputProofDigest: string | null;
    readonly universeConfigurationDigest: string;
}
export type TaprootAssetTransferRequest = AuthorizedValueOperationExecution<TaprootAssetTransferArtifact>;
const UNIVERSE_CONFIGURATION_DIGEST = digestCanonicalPayload(Object.freeze({ kind: 'conxius.wallet.unqualified-taproot-assets-universe.v1' }));

export function createTaprootAssetTransferArtifact(fields: {
    assetId: string; amount: bigint | string; recipient: string; virtualTransactionCommitment: string;
    inputProofDigest?: string; network?: Network;
}): TaprootAssetTransferArtifact {
    const amount = typeof fields.amount === 'bigint' ? fields.amount.toString() : fields.amount.trim();
    if (!fields.assetId.trim() || !/^(0|[1-9][0-9]*)$/.test(amount) || !fields.recipient.trim() || !fields.virtualTransactionCommitment.trim()) {
        throw new Error('Invalid Taproot Assets transfer request.');
    }
    return Object.freeze({
        kind: 'conxius.wallet.taproot-assets-transfer.v1', chain: 'bitcoin', layer: 'taproot-assets',
        operation: 'transfer-asset', network: fields.network ?? 'mainnet', assetId: fields.assetId.trim(), amount,
        recipient: fields.recipient.trim(), virtualTransactionCommitment: fields.virtualTransactionCommitment.trim(),
        inputProofDigest: fields.inputProofDigest ?? null, universeConfigurationDigest: UNIVERSE_CONFIGURATION_DIGEST,
    });
}

export async function discoverTaprootAssets(): Promise<TaprootAsset[]> {
    return [];
}

export async function transferTaprootAsset(request: TaprootAssetTransferRequest): Promise<ValueOperationExecutionOutcome> {
    return knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.taproot-assets-transfer.v1', operationType: 'transfer-asset', layer: 'taproot-assets', chain: 'bitcoin',
    });
}
