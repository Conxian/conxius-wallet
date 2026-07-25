import { Buffer } from 'buffer';
import { bech32m } from 'bech32';
import { type Network } from '../types';
import { getTransactionStatus } from './protocol';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import {
    knownUnsupportedValueOperation,
    type AuthorizedValueOperationExecution,
    type ValueOperationExecutionOutcome,
} from './value-operation-result';

export type RgbSchema = 'RGB20' | 'RGB21' | 'RGB25' | 'NIA';
export interface RgbAsset { id: string; name: string; symbol: string; precision: number; totalSupply: number; schema: RgbSchema; issuedAt: number; initialSeal: string; description?: string; }
export interface RgbAnchor { txid: string; vout: number; amount: number; }
export interface Consignment { id: string; assetId: string; vouts: number[]; anchor?: RgbAnchor; witness: string; endpoints: string[]; }
export interface RgbInvoice { assetId: string; amount: number; beneficiary: string; expiry?: number; }

export interface RgbIssuanceArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.rgb-issuance.v1'; readonly chain: 'bitcoin'; readonly layer: 'rgb';
    readonly operation: 'issue-asset'; readonly network: string; readonly name: string; readonly symbol: string;
    readonly totalSupply: string; readonly precision: string; readonly schema: RgbSchema; readonly initialSeal: string;
    readonly description: string | null; readonly validatorConfigurationDigest: string;
}
export interface RgbTransferArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.rgb-transfer.v1'; readonly chain: 'bitcoin'; readonly layer: 'rgb';
    readonly operation: 'transfer-asset'; readonly network: string; readonly assetId: string; readonly amount: string;
    readonly beneficiary: string; readonly transitionCommitment: string; readonly anchorTxid: string | null;
    readonly anchorVout: string | null; readonly proofDigest: string | null; readonly validatorConfigurationDigest: string;
}
export type RgbIssuanceRequest = AuthorizedValueOperationExecution<RgbIssuanceArtifact>;
export type RgbTransferRequest = AuthorizedValueOperationExecution<RgbTransferArtifact>;

const RGB_VALIDATOR_CONFIGURATION_DIGEST = digestCanonicalPayload(Object.freeze({ kind: 'conxius.wallet.unavailable-rgb-validator.v1' }));
function canonicalNonNegativeInteger(value: number, field: string): string {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${field}.`);
    return String(value);
}
function canonicalAmount(value: string): string {
    const normalized = value.trim();
    if (!/^(0|[1-9][0-9]*)$/.test(normalized)) throw new Error('Invalid RGB amount.');
    return normalized;
}

export function createRgbIssuanceArtifact(fields: {
    name: string; symbol: string; totalSupply: string; precision: number; schema: RgbSchema;
    initialSeal: string; description?: string; network?: string;
}): RgbIssuanceArtifact {
    if (!/^[a-fA-F0-9]{64}:[0-9]+$/.test(fields.initialSeal) || !fields.name.trim() || !fields.symbol.trim()) {
        throw new Error('Invalid RGB issuance request.');
    }
    return Object.freeze({
        kind: 'conxius.wallet.rgb-issuance.v1', chain: 'bitcoin', layer: 'rgb', operation: 'issue-asset',
        network: fields.network ?? 'mainnet', name: fields.name.trim(), symbol: fields.symbol.trim(),
        totalSupply: canonicalAmount(fields.totalSupply), precision: canonicalNonNegativeInteger(fields.precision, 'precision'),
        schema: fields.schema, initialSeal: fields.initialSeal, description: fields.description?.trim() || null,
        validatorConfigurationDigest: RGB_VALIDATOR_CONFIGURATION_DIGEST,
    });
}

export function createRgbTransferArtifact(fields: {
    assetId: string; amount: string; beneficiary: string; transitionCommitment: string; anchorTxid?: string;
    anchorVout?: number; proofDigest?: string; network?: string;
}): RgbTransferArtifact {
    if (!fields.assetId.startsWith('rgb:') || !fields.beneficiary.trim() || !fields.transitionCommitment.trim()) {
        throw new Error('Invalid RGB transfer request.');
    }
    return Object.freeze({
        kind: 'conxius.wallet.rgb-transfer.v1', chain: 'bitcoin', layer: 'rgb', operation: 'transfer-asset',
        network: fields.network ?? 'mainnet', assetId: fields.assetId, amount: canonicalAmount(fields.amount),
        beneficiary: fields.beneficiary.trim(), transitionCommitment: fields.transitionCommitment.trim(),
        anchorTxid: fields.anchorTxid ?? null,
        anchorVout: fields.anchorVout === undefined ? null : canonicalNonNegativeInteger(fields.anchorVout, 'anchor output'),
        proofDigest: fields.proofDigest ?? null, validatorConfigurationDigest: RGB_VALIDATOR_CONFIGURATION_DIGEST,
    });
}

export const issueRgbAsset = async (request: RgbIssuanceRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.rgb-issuance.v1', operationType: 'issue-asset', layer: 'rgb', chain: 'bitcoin',
    });
export const createRgbTransfer = async (request: RgbTransferRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.rgb-transfer.v1', operationType: 'transfer-asset', layer: 'rgb', chain: 'bitcoin',
    });

export const validateConsignment = async (consignment: Consignment, network: Network = 'mainnet'): Promise<boolean> => {
    if (
        typeof consignment !== 'object'
        || consignment === null
        || typeof consignment.id !== 'string'
        || typeof consignment.assetId !== 'string'
        || !consignment.assetId.startsWith('rgb:')
        || typeof consignment.witness !== 'string'
        || !Array.isArray(consignment.vouts)
        || consignment.vouts.length === 0
    ) return false;
    if (consignment.anchor) {
        if (consignment.anchor.amount < 546) return false;
        const status = await getTransactionStatus(consignment.anchor.txid, 'Mainnet', network);
        if (status.status !== 'completed') return false;
    }
    try { return await verifyRgbProofWasm(consignment.witness); } catch { return false; }
};

/** Authoritative RGB WASM validation is not linked in this build. */
export async function verifyRgbProofWasm(witness: string): Promise<boolean> { void witness; return false; }

export const parseRgbInvoice = (invoice: string): RgbInvoice | null => {
    try {
        if (!invoice.startsWith('rgb:')) return null;
        const decoded = bech32m.decode(invoice.slice(4));
        if (decoded.prefix !== 'rgb') return null;
        const hexData = Buffer.from(bech32m.fromWords(decoded.words)).toString('hex');
        return { assetId: `rgb:${hexData.substring(0, 32)}`, amount: parseInt(hexData.substring(32, 48), 16) || 0, beneficiary: hexData.substring(48) || 'blinded_utxo' };
    } catch { return null; }
};

export const syncStash = async (address: string): Promise<number> => {
    void address;
    return 0;
};
