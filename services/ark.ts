import { endpointsFor, fetchWithRetry } from './network';
import { Network } from '../types';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import {
    knownUnsupportedValueOperation,
    type AuthorizedValueOperationExecution,
    type ValueOperationExecutionOutcome,
} from './value-operation-result';

export interface VTXO {
    txid: string;
    vout: number;
    amount: number;
    ownerPubkey: string;
    serverPubkey: string;
    roundTxid: string;
    expiryHeight: number;
    status: 'pending' | 'available' | 'spent' | 'lifting' | 'forfeited';
}

export interface LiftRequest {
    amountSats: number;
    senderAddress: string;
    senderPubkey: string;
    network: Network;
    feeRate?: number;
}

export type ArkLiftOutcome =
    | Readonly<{ kind: 'rejected'; reason: 'malformed_lift_request' }>
    | Readonly<{ kind: 'unsupported'; reason: 'qualified_asp_boarding_data_unavailable' }>;

export interface ArkForfeitArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.ark-forfeit.v1';
    readonly chain: 'bitcoin';
    readonly layer: 'ark';
    readonly operation: 'forfeit-vtxo';
    readonly network: Network;
    readonly recipient: string;
    readonly amountSats: string;
    readonly vtxoTxid: string;
    readonly vtxoVout: string;
    readonly ownerPubkey: string;
    readonly serverPubkey: string;
    readonly roundTxid: string;
    readonly expiryHeight: string;
    readonly currentStatus: VTXO['status'];
    readonly aspConfigurationDigest: string;
}

export interface ArkRedeemArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.ark-redeem.v1';
    readonly chain: 'bitcoin';
    readonly layer: 'ark';
    readonly operation: 'unilateral-exit';
    readonly network: Network;
    readonly destination: 'bitcoin-l1-unilateral-exit';
    readonly amountSats: string;
    readonly vtxoTxid: string;
    readonly vtxoVout: string;
    readonly ownerPubkey: string;
    readonly serverPubkey: string;
    readonly roundTxid: string;
    readonly expiryHeight: string;
    readonly currentStatus: VTXO['status'];
    readonly aspConfigurationDigest: string;
}

export type ArkForfeitRequest = AuthorizedValueOperationExecution<ArkForfeitArtifact>;
export type ArkRedeemRequest = AuthorizedValueOperationExecution<ArkRedeemArtifact>;

const ARK_ASP_CONFIGURATION_DIGEST = digestCanonicalPayload(Object.freeze({
    kind: 'conxius.wallet.unqualified-ark-asp.v1',
}));

function canonicalInteger(value: number, field: string): string {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${field}.`);
    return String(value);
}

export function createArkForfeitArtifact(
    vtxo: VTXO,
    recipient: string,
    network: Network,
): ArkForfeitArtifact {
    if (!vtxo.txid || !recipient.trim()) throw new Error('Invalid Ark forfeit request.');
    return Object.freeze({
        kind: 'conxius.wallet.ark-forfeit.v1', chain: 'bitcoin', layer: 'ark', operation: 'forfeit-vtxo',
        network, recipient: recipient.trim(), amountSats: canonicalInteger(vtxo.amount, 'VTXO amount'),
        vtxoTxid: vtxo.txid, vtxoVout: canonicalInteger(vtxo.vout, 'VTXO output'), ownerPubkey: vtxo.ownerPubkey,
        serverPubkey: vtxo.serverPubkey, roundTxid: vtxo.roundTxid,
        expiryHeight: canonicalInteger(vtxo.expiryHeight, 'VTXO expiry height'), currentStatus: vtxo.status,
        aspConfigurationDigest: ARK_ASP_CONFIGURATION_DIGEST,
    });
}

export function createArkRedeemArtifact(vtxo: VTXO, network: Network): ArkRedeemArtifact {
    if (!vtxo.txid) throw new Error('Invalid Ark redeem request.');
    return Object.freeze({
        kind: 'conxius.wallet.ark-redeem.v1', chain: 'bitcoin', layer: 'ark', operation: 'unilateral-exit',
        network, destination: 'bitcoin-l1-unilateral-exit', amountSats: canonicalInteger(vtxo.amount, 'VTXO amount'),
        vtxoTxid: vtxo.txid, vtxoVout: canonicalInteger(vtxo.vout, 'VTXO output'), ownerPubkey: vtxo.ownerPubkey,
        serverPubkey: vtxo.serverPubkey, roundTxid: vtxo.roundTxid,
        expiryHeight: canonicalInteger(vtxo.expiryHeight, 'VTXO expiry height'), currentStatus: vtxo.status,
        aspConfigurationDigest: ARK_ASP_CONFIGURATION_DIGEST,
    });
}

/**
 * Ark Protocol Service (M5 Implementation)
 * Handles off-chain VTXO lifecycle management and Boarding (Lifting).
 */

/**
 * Creates a Boarding (Lift) Transaction PSBT.
 * Moves L1 BTC -> Ark Boarding Address.
 */
export const createLiftPsbt = async (req: LiftRequest): Promise<ArkLiftOutcome> => {
    if (
        typeof req !== 'object'
        || req === null
        || !Number.isSafeInteger(req.amountSats)
        || req.amountSats <= 0
        || typeof req.senderAddress !== 'string'
        || !req.senderAddress.trim()
        || typeof req.senderPubkey !== 'string'
        || !req.senderPubkey.trim()
        || (req.feeRate !== undefined && (!Number.isFinite(req.feeRate) || req.feeRate <= 0))
    ) {
        return Object.freeze({ kind: 'rejected', reason: 'malformed_lift_request' });
    }
    return Object.freeze({ kind: 'unsupported', reason: 'qualified_asp_boarding_data_unavailable' });
};

/**
 * Syncs VTXOs from the Ark Service Provider (ASP).
 */
export const syncVtxos = async (address: string, network: Network = 'mainnet'): Promise<VTXO[]> => {
    try {
        const { ARK_API } = endpointsFor(network);
        if (!ARK_API) return [];

        const response = await fetchWithRetry(`${ARK_API}/v1/vtxos/${address}`, {}, 1, 1000);
        
        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return (data.vtxos || []).map((v: any) => ({
            txid: v.txid,
            vout: v.vout,
            amount: v.amount,
            ownerPubkey: v.ownerPubkey,
            serverPubkey: v.serverPubkey,
            roundTxid: v.roundTxid,
            expiryHeight: v.expiryHeight,
            status: v.status || 'available'
        }));

    } catch (e) {
        console.warn('[Ark] Sync failed', e);
        return [];
    }
};

/**
 * Forfeits a VTXO back to L1 or to another user (Off-chain Transfer).
 * This broadcasts a signed forfeit transaction via the ASP.
 */
export const forfeitVtxo = async (request: ArkForfeitRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.ark-forfeit.v1', operationType: 'forfeit-vtxo', layer: 'ark', chain: 'bitcoin',
    });

/**
 * Redeems a VTXO (Unilateral Exit).
 * This creates a transaction that spends the VTXO and broadcasts it to Bitcoin L1.
 */
export const redeemVtxo = async (request: ArkRedeemRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.ark-redeem.v1', operationType: 'unilateral-exit', layer: 'ark', chain: 'bitcoin',
    });
