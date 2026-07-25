import type { Network, UTXO } from '../types';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import {
    knownUnsupportedValueOperation,
    type AuthorizedValueOperationExecution,
    type ValueOperationExecutionOutcome,
} from './value-operation-result';

export interface CoinJoinRound {
    readonly roundId: string;
    readonly phase: 'InputRegistration' | 'ConnectionConfirmation' | 'OutputRegistration' | 'Signing' | 'Ended';
    readonly inputVbytes: number;
    readonly outputVbytes: number;
    readonly miningFeeRate: number;
    readonly coordinatorFeeRate: number;
    readonly minInputCount: number;
    readonly maxInputCount: number;
}

export type CoinJoinRoundDiscoveryResult = Readonly<{
    kind: 'unsupported';
    reason: 'qualified_coordinator_unavailable';
    rounds: readonly CoinJoinRound[];
}>;

export interface CoinJoinInputRegistrationArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.coinjoin-input-registration.v1';
    readonly operation: 'register-coinjoin-inputs';
    readonly chain: 'bitcoin';
    readonly layer: 'coinjoin';
    readonly network: Network;
    readonly roundId: string;
    readonly inputSetDigest: string;
    readonly changeAddress: string;
    readonly coordinatorConfigurationDigest: string;
}

export interface CoinJoinOutputRegistrationArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.coinjoin-output-registration.v1';
    readonly operation: 'register-coinjoin-output';
    readonly chain: 'bitcoin';
    readonly layer: 'coinjoin';
    readonly network: Network;
    readonly roundId: string;
    readonly registrationTokenDigest: string;
    readonly outputAddress: string;
    readonly credentialSetDigest: string;
    readonly coordinatorConfigurationDigest: string;
}

export type CoinJoinInputRegistrationRequest = AuthorizedValueOperationExecution<CoinJoinInputRegistrationArtifact>;
export type CoinJoinOutputRegistrationRequest = AuthorizedValueOperationExecution<CoinJoinOutputRegistrationArtifact>;

const DIGEST = /^[0-9a-f]{64}$/;

function required(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) throw new Error(`Invalid CoinJoin ${field}.`);
    return normalized;
}

function exactDigest(value: string, field: string): string {
    const normalized = value.trim().toLowerCase();
    if (!DIGEST.test(normalized)) throw new Error(`Invalid CoinJoin ${field} digest.`);
    return normalized;
}

function canonicalInteger(value: number, field: string): string {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid CoinJoin ${field}.`);
    return String(value);
}

export function createCoinJoinInputRegistrationArtifact(fields: {
    roundId: string;
    utxos: readonly UTXO[];
    changeAddress: string;
    network: Network;
    coordinatorConfigurationDigest: string;
}): CoinJoinInputRegistrationArtifact {
    if (fields.utxos.length === 0) throw new Error('Invalid CoinJoin input set.');
    const inputs = Object.freeze(fields.utxos.map((utxo) => Object.freeze({
        txid: required(utxo.txid, 'input txid'), vout: canonicalInteger(utxo.vout, 'input output'),
        amountSats: canonicalInteger(utxo.amount, 'input amount'), address: required(utxo.address, 'input address'),
        script: utxo.script ?? '', status: utxo.status, frozen: utxo.isFrozen,
    })));
    return Object.freeze({
        kind: 'conxius.wallet.coinjoin-input-registration.v1', operation: 'register-coinjoin-inputs',
        chain: 'bitcoin', layer: 'coinjoin', network: fields.network, roundId: required(fields.roundId, 'round'),
        inputSetDigest: digestCanonicalPayload(inputs), changeAddress: required(fields.changeAddress, 'change address'),
        coordinatorConfigurationDigest: exactDigest(fields.coordinatorConfigurationDigest, 'coordinator configuration'),
    });
}

export function createCoinJoinOutputRegistrationArtifact(fields: {
    roundId: string;
    registrationToken: string;
    outputAddress: string;
    credentialCommitments: readonly string[];
    network: Network;
    coordinatorConfigurationDigest: string;
}): CoinJoinOutputRegistrationArtifact {
    if (fields.credentialCommitments.length === 0) throw new Error('Invalid CoinJoin credential set.');
    return Object.freeze({
        kind: 'conxius.wallet.coinjoin-output-registration.v1', operation: 'register-coinjoin-output',
        chain: 'bitcoin', layer: 'coinjoin', network: fields.network, roundId: required(fields.roundId, 'round'),
        registrationTokenDigest: digestCanonicalPayload(Object.freeze({
            kind: 'conxius.wallet.coinjoin-registration-token.v1', value: required(fields.registrationToken, 'registration token'),
        })),
        outputAddress: required(fields.outputAddress, 'output address'),
        credentialSetDigest: digestCanonicalPayload(Object.freeze(fields.credentialCommitments.map((commitment) =>
            exactDigest(commitment, 'credential commitment')))),
        coordinatorConfigurationDigest: exactDigest(fields.coordinatorConfigurationDigest, 'coordinator configuration'),
    });
}

/** No coordinator rounds are represented without a qualified, validated provider. */
export async function fetchActiveRounds(_network: Network): Promise<CoinJoinRoundDiscoveryResult> {
    void _network;
    return Object.freeze({ kind: 'unsupported', reason: 'qualified_coordinator_unavailable', rounds: Object.freeze([]) });
}

export async function registerInputs(request: CoinJoinInputRegistrationRequest): Promise<ValueOperationExecutionOutcome> {
    return knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.coinjoin-input-registration.v1', operationType: 'register-coinjoin-inputs',
        layer: 'coinjoin', chain: 'bitcoin',
    });
}

export async function registerOutput(request: CoinJoinOutputRegistrationRequest): Promise<ValueOperationExecutionOutcome> {
    return knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.coinjoin-output-registration.v1', operationType: 'register-coinjoin-output',
        layer: 'coinjoin', chain: 'bitcoin',
    });
}
