import type { Network } from '../types';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import {
    knownUnsupportedValueOperation,
    type AuthorizedValueOperationExecution,
    type ValueOperationExecutionOutcome,
} from './value-operation-result';

export interface DLCOutcome extends CanonicalObject {
    readonly label: string;
    readonly payoutSats: string;
}

export interface DLCOfferProposal extends CanonicalObject {
    readonly kind: 'conxius.wallet.dlc-offer-proposal.v1';
    readonly proposalId: string;
    readonly chain: 'bitcoin';
    readonly layer: 'dlc';
    readonly network: Network;
    readonly oraclePubkey: string;
    readonly eventDescriptor: string;
    readonly collateralSats: string;
    readonly counterpartyCollateralSats: string;
    readonly outcomes: readonly DLCOutcome[];
    readonly expiryUnixSeconds: string;
    readonly status: 'unsigned-proposal';
}

export interface DLCAcceptanceArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.dlc-acceptance.v1';
    readonly operation: 'accept-dlc-offer';
    readonly chain: 'bitcoin';
    readonly layer: 'dlc';
    readonly network: Network;
    readonly offerDigest: string;
    readonly oraclePubkeyDigest: string;
    readonly eventDescriptorDigest: string;
    readonly outcomesDigest: string;
    readonly fundingTransactionDigest: string;
    readonly cetSetDigest: string;
}

export interface DLCSettlementArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.dlc-settlement.v1';
    readonly operation: 'settle-dlc';
    readonly chain: 'bitcoin';
    readonly layer: 'dlc';
    readonly network: Network;
    readonly contractDigest: string;
    readonly offerDigest: string;
    readonly oracleAttestationDigest: string;
    readonly outcome: string;
    readonly cetTransactionDigest: string;
}

export type DLCAcceptanceRequest = AuthorizedValueOperationExecution<DLCAcceptanceArtifact>;
export type DLCSettlementRequest = AuthorizedValueOperationExecution<DLCSettlementArtifact>;

const DIGEST = /^[0-9a-f]{64}$/;

function required(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) throw new Error(`Invalid DLC ${field}.`);
    return normalized;
}

function canonicalUnsigned(value: number | string, field: string): string {
    const normalized = typeof value === 'number' ? String(value) : value;
    if (!/^(0|[1-9][0-9]*)$/.test(normalized)) throw new Error(`Invalid DLC ${field}.`);
    const numeric = Number(normalized);
    if (!Number.isSafeInteger(numeric) || numeric < 0) throw new Error(`Invalid DLC ${field}.`);
    return normalized;
}

function exactDigest(value: string, field: string): string {
    const normalized = value.trim().toLowerCase();
    if (!DIGEST.test(normalized)) throw new Error(`Invalid DLC ${field} digest.`);
    return normalized;
}

function digestText(kind: string, value: string): string {
    return digestCanonicalPayload(Object.freeze({ kind, value: required(value, kind) }));
}

/** Creates a deterministic unsigned proposal. It is not accepted, active, signed, or settled. */
export function createDLCOffer(fields: {
    oraclePubkey: string;
    eventDescriptor: string;
    collateralSats: number | string;
    counterpartyCollateralSats: number | string;
    outcomes: readonly { label: string; payoutSats: number | string }[];
    expiryUnixSeconds: number | string;
    network: Network;
}): DLCOfferProposal {
    if (fields.outcomes.length === 0) throw new Error('Invalid DLC outcomes.');
    const body = Object.freeze({
        chain: 'bitcoin' as const,
        layer: 'dlc' as const,
        network: fields.network,
        oraclePubkey: required(fields.oraclePubkey, 'oracle public key'),
        eventDescriptor: required(fields.eventDescriptor, 'event descriptor'),
        collateralSats: canonicalUnsigned(fields.collateralSats, 'collateral'),
        counterpartyCollateralSats: canonicalUnsigned(fields.counterpartyCollateralSats, 'counterparty collateral'),
        outcomes: Object.freeze(fields.outcomes.map((outcome) => Object.freeze({
            label: required(outcome.label, 'outcome label'),
            payoutSats: canonicalUnsigned(outcome.payoutSats, 'outcome payout'),
        }))),
        expiryUnixSeconds: canonicalUnsigned(fields.expiryUnixSeconds, 'expiry'),
    });
    const proposalId = `dlc-proposal:${digestCanonicalPayload(Object.freeze({
        kind: 'conxius.wallet.dlc-offer-proposal-body.v1', ...body,
    }))}`;
    return Object.freeze({
        kind: 'conxius.wallet.dlc-offer-proposal.v1', proposalId, ...body, status: 'unsigned-proposal',
    });
}

export function createDLCAcceptanceArtifact(fields: {
    offer: DLCOfferProposal;
    fundingTransactionDigest: string;
    cetTemplates: readonly { outcome: string; transactionDigest: string }[];
}): DLCAcceptanceArtifact {
    if (fields.cetTemplates.length === 0) throw new Error('Invalid DLC CET set.');
    return Object.freeze({
        kind: 'conxius.wallet.dlc-acceptance.v1', operation: 'accept-dlc-offer', chain: 'bitcoin', layer: 'dlc',
        network: fields.offer.network, offerDigest: digestCanonicalPayload(fields.offer),
        oraclePubkeyDigest: digestText('conxius.wallet.dlc-oracle-pubkey.v1', fields.offer.oraclePubkey),
        eventDescriptorDigest: digestText('conxius.wallet.dlc-event-descriptor.v1', fields.offer.eventDescriptor),
        outcomesDigest: digestCanonicalPayload(fields.offer.outcomes),
        fundingTransactionDigest: exactDigest(fields.fundingTransactionDigest, 'funding transaction'),
        cetSetDigest: digestCanonicalPayload(Object.freeze(fields.cetTemplates.map((cet) => Object.freeze({
            outcome: required(cet.outcome, 'CET outcome'),
            transactionDigest: exactDigest(cet.transactionDigest, 'CET transaction'),
        })))),
    });
}

export function createDLCSettlementArtifact(fields: {
    contract: CanonicalObject;
    offer: DLCOfferProposal;
    oracleAttestation: string;
    outcome: string;
    cetTransactionDigest: string;
}): DLCSettlementArtifact {
    return Object.freeze({
        kind: 'conxius.wallet.dlc-settlement.v1', operation: 'settle-dlc', chain: 'bitcoin', layer: 'dlc',
        network: fields.offer.network, contractDigest: digestCanonicalPayload(fields.contract),
        offerDigest: digestCanonicalPayload(fields.offer),
        oracleAttestationDigest: digestText('conxius.wallet.dlc-oracle-attestation.v1', fields.oracleAttestation),
        outcome: required(fields.outcome, 'settlement outcome'),
        cetTransactionDigest: exactDigest(fields.cetTransactionDigest, 'settlement CET transaction'),
    });
}

/** Production DLC acceptance is unavailable before signing, storage, or notifications. */
export async function acceptDLCOffer(request: DLCAcceptanceRequest): Promise<ValueOperationExecutionOutcome> {
    return knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.dlc-acceptance.v1', operationType: 'accept-dlc-offer', layer: 'dlc', chain: 'bitcoin',
    });
}

/** Production DLC settlement is unavailable before CET signing or broadcast. */
export async function settleDLC(request: DLCSettlementRequest): Promise<ValueOperationExecutionOutcome> {
    return knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.dlc-settlement.v1', operationType: 'settle-dlc', layer: 'dlc', chain: 'bitcoin',
    });
}

/** Read-only event templates. These are not oracle attestations or active contracts. */
export async function fetchDLCEvents() {
    return [
        { id: 'btc_price_100k', name: 'BTC > 100k by End of 2026', oracle: 'P2P.org Oracle', kind: 'unsigned-template' as const },
        { id: 'superbowl_2027', name: 'Super Bowl LXI Winner', oracle: 'Satlantis Oracle', kind: 'unsigned-template' as const },
    ];
}
