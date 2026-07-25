import { Network } from '../types';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import {
    knownUnsupportedValueOperation,
    type AuthorizedValueOperationExecution,
    type ValueOperationExecutionOutcome,
} from './value-operation-result';

export interface StateChainUtxo { id: string; amount: number; lockTime: number; index: number; status: 'active' | 'transferring' | 'spent'; }

export interface StateChainTransferArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.statechain-transfer.v1'; readonly chain: 'bitcoin'; readonly layer: 'statechain';
    readonly operation: 'rotate-ownership'; readonly network: Network; readonly utxoId: string;
    readonly recipientPubkey: string; readonly currentIndex: string; readonly coordinatorConfigurationDigest: string;
}
export interface StateChainWithdrawalArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.statechain-withdrawal.v1'; readonly chain: 'bitcoin'; readonly layer: 'statechain';
    readonly operation: 'withdraw-to-l1'; readonly network: Network; readonly utxoId: string;
    readonly destination: string; readonly currentIndex: string; readonly withdrawalCommitment: string;
    readonly coordinatorConfigurationDigest: string;
}
export type StateChainTransferRequest = AuthorizedValueOperationExecution<StateChainTransferArtifact>;
export type StateChainWithdrawalRequest = AuthorizedValueOperationExecution<StateChainWithdrawalArtifact>;

const COORDINATOR_CONFIGURATION_DIGEST = digestCanonicalPayload(Object.freeze({ kind: 'conxius.wallet.unqualified-statechain-coordinator.v1' }));
function canonicalIndex(value: number): string {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid StateChain index.');
    return String(value);
}

export function createStateChainTransferArtifact(fields: {
    utxoId: string; recipientPubkey: string; currentIndex: number; network?: Network;
}): StateChainTransferArtifact {
    if (!fields.utxoId.trim() || !fields.recipientPubkey.trim()) throw new Error('Invalid StateChain transfer request.');
    return Object.freeze({
        kind: 'conxius.wallet.statechain-transfer.v1', chain: 'bitcoin', layer: 'statechain', operation: 'rotate-ownership',
        network: fields.network ?? 'mainnet', utxoId: fields.utxoId.trim(), recipientPubkey: fields.recipientPubkey.trim(),
        currentIndex: canonicalIndex(fields.currentIndex), coordinatorConfigurationDigest: COORDINATOR_CONFIGURATION_DIGEST,
    });
}

export function createStateChainWithdrawalArtifact(fields: {
    utxoId: string; destination: string; currentIndex: number; withdrawalCommitment: string; network?: Network;
}): StateChainWithdrawalArtifact {
    if (!fields.utxoId.trim() || !fields.destination.trim() || !fields.withdrawalCommitment.trim()) {
        throw new Error('Invalid StateChain withdrawal request.');
    }
    return Object.freeze({
        kind: 'conxius.wallet.statechain-withdrawal.v1', chain: 'bitcoin', layer: 'statechain', operation: 'withdraw-to-l1',
        network: fields.network ?? 'mainnet', utxoId: fields.utxoId.trim(), destination: fields.destination.trim(),
        currentIndex: canonicalIndex(fields.currentIndex), withdrawalCommitment: fields.withdrawalCommitment.trim(),
        coordinatorConfigurationDigest: COORDINATOR_CONFIGURATION_DIGEST,
    });
}

export const transferStateChainUtxo = async (request: StateChainTransferRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.statechain-transfer.v1', operationType: 'rotate-ownership', layer: 'statechain', chain: 'bitcoin',
    });

export const withdrawStateChainUtxo = async (request: StateChainWithdrawalRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.statechain-withdrawal.v1', operationType: 'withdraw-to-l1', layer: 'statechain', chain: 'bitcoin',
    });
