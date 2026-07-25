import { Capacitor, registerPlugin } from '@capacitor/core';
import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { getPublicKeyNative } from './enclave-storage';
import { finalizePsbtWithSigs, getPsbtSighashes, getUnsignedTxHex } from './psbt';
import { digestCanonicalPayload, digestValueOperationEnvelope } from './value-operation-gate';
import {
    consumeAuthorizedValueOperationStage,
    createBitcoinPsbtOperationPayload,
    digestBitcoinPsbtOperation,
    type AuthorizedValueOperation,
} from './value-operations';
import type { Network } from '../types';

export interface NativeValueSigningRequest {
    readonly authorization: AuthorizedValueOperation;
    readonly psbt: string;
    readonly network: Network;
    /** Opaque native wallet record identifier. Never pass seed or mnemonic material. */
    readonly vault: string;
    readonly derivationPath?: string;
}

export interface SignerIssuedBitcoinBroadcastArtifact {
    readonly kind: 'signer-issued-bitcoin-broadcast';
    readonly transactionHex: string;
    readonly envelopeDigest: string;
    readonly sourceOperationDigest: string;
    readonly transactionHexDigest: string;
    readonly finalizedTransactionDigest: string;
    readonly authorizedTransitionDigest: string;
}

interface BitcoinBroadcastProvenanceRecord {
    readonly authorization: AuthorizedValueOperation;
    readonly capability: AuthorizedValueOperation['capability'];
    readonly envelopeDigest: string;
    readonly sourceOperationDigest: string;
    readonly transactionHex: string;
    readonly transactionHexDigest: string;
    readonly finalizedTransactionDigest: string;
    readonly authorizedTransitionDigest: string;
}

export type BitcoinBroadcastProvenanceInspection =
    | Readonly<{
        kind: 'validated';
        transactionHex: string;
        envelopeDigest: string;
        sourceOperationDigest: string;
        transactionHexDigest: string;
        finalizedTransactionDigest: string;
        authorizedTransitionDigest: string;
    }>
    | Readonly<{ kind: 'rejected'; reason: 'forged_broadcast_artifact' | 'mismatched_authorization' | 'broadcast_digest_mismatch' }>;

export type NativeValueSigningOutcome =
    | Readonly<{
        kind: 'signed';
        signature: string;
        pubkey: string;
        broadcastReadyHex: string;
        broadcastArtifact: SignerIssuedBitcoinBroadcastArtifact;
        timestamp: number;
    }>
    | Readonly<{ kind: 'rejected'; reason:
        | 'expired_authorization'
        | 'forged_authorization'
        | 'mismatched_authorization'
        | 'consumed_authorization'
        | 'native_signing_failed'
        | 'invalid_native_artifact' }>
    | Readonly<{ kind: 'unsupported'; reason: 'non_native_platform' | 'native_enclave_unavailable' }>;

const HEX_PATTERN = /^[0-9a-f]+$/i;
const bitcoinBroadcastProvenance = new WeakMap<object, BitcoinBroadcastProvenanceRecord>();

type GateBoundValueSignerPlugin = {
    signBatch(options: {
        vault: string;
        path: string;
        hashes: string[];
        network: string;
        payload: string;
    }): Promise<{ signatures: { signature: string; pubkey?: string }[] }>;
};

// Module-private: no production caller can obtain a raw native batch signer.
const GateBoundValueSigner = registerPlugin<GateBoundValueSignerPlugin>('SecureEnclave');

function isValidHex(value: unknown, minimumBytes: number): value is string {
    return typeof value === 'string'
        && value.length >= minimumBytes * 2
        && value.length % 2 === 0
        && HEX_PATTERN.test(value);
}

function isValidPublicKey(value: unknown): value is string {
    return isValidHex(value, 32) && [64, 66, 130].includes(value.length);
}

function normalizeTransactionHex(transactionHex: string): string {
    const normalized = transactionHex.trim().toLowerCase();
    if (!isValidHex(normalized, 1)) throw new Error('invalid transaction hex');
    return normalized;
}

export function digestBitcoinTransactionHex(transactionHex: string): string {
    const normalized = normalizeTransactionHex(transactionHex);
    return digestCanonicalPayload(Object.freeze({
        kind: 'bitcoin-transaction-hex' as const,
        transactionHex: normalized,
    }));
}

function digestFinalizedBitcoinTransaction(
    transactionHexDigest: string,
): string {
    return digestCanonicalPayload(Object.freeze({
        kind: 'bitcoin-finalized-transaction' as const,
        transactionHexDigest,
    }));
}

function digestAuthorizedPsbtFinalization(
    envelopeDigest: string,
    sourceOperationDigest: string,
    finalizedTransactionDigest: string,
): string {
    return digestCanonicalPayload(Object.freeze({
        kind: 'authorized-bitcoin-psbt-finalization' as const,
        envelopeDigest,
        sourceOperationDigest,
        finalizedTransactionDigest,
    }));
}

function issueBitcoinBroadcastArtifact(
    authorization: AuthorizedValueOperation,
    transactionHex: string,
): SignerIssuedBitcoinBroadcastArtifact {
    const normalizedTransactionHex = normalizeTransactionHex(transactionHex);
    const sourceOperationDigest = authorization.envelope.canonicalOperationDigest;
    const transactionHexDigest = digestBitcoinTransactionHex(normalizedTransactionHex);
    const finalizedTransactionDigest = digestFinalizedBitcoinTransaction(transactionHexDigest);
    const authorizedTransitionDigest = digestAuthorizedPsbtFinalization(
        authorization.envelopeDigest,
        sourceOperationDigest,
        finalizedTransactionDigest,
    );
    const artifact = Object.freeze({
        kind: 'signer-issued-bitcoin-broadcast' as const,
        transactionHex: normalizedTransactionHex,
        envelopeDigest: authorization.envelopeDigest,
        sourceOperationDigest,
        transactionHexDigest,
        finalizedTransactionDigest,
        authorizedTransitionDigest,
    });
    bitcoinBroadcastProvenance.set(artifact, Object.freeze({
        authorization,
        capability: authorization.capability,
        envelopeDigest: authorization.envelopeDigest,
        sourceOperationDigest,
        transactionHex: normalizedTransactionHex,
        transactionHexDigest,
        finalizedTransactionDigest,
        authorizedTransitionDigest,
    }));
    return artifact;
}

/**
* Validates signer-issued PSBT→final-transaction lineage. This function can
* inspect provenance but cannot create it; issuance remains module-private.
*/
export function inspectSignerIssuedBitcoinBroadcastArtifact(
    authorization: AuthorizedValueOperation,
    artifact: SignerIssuedBitcoinBroadcastArtifact,
): BitcoinBroadcastProvenanceInspection {
    if (typeof artifact !== 'object' || artifact === null) {
        return Object.freeze({ kind: 'rejected', reason: 'forged_broadcast_artifact' });
    }
    const record = bitcoinBroadcastProvenance.get(artifact);
    if (!record) return Object.freeze({ kind: 'rejected', reason: 'forged_broadcast_artifact' });
    if (record.authorization !== authorization || record.capability !== authorization.capability) {
        return Object.freeze({ kind: 'rejected', reason: 'mismatched_authorization' });
    }
    try {
        const transactionHex = normalizeTransactionHex(artifact.transactionHex);
        const transactionHexDigest = digestBitcoinTransactionHex(transactionHex);
        const finalizedTransactionDigest = digestFinalizedBitcoinTransaction(transactionHexDigest);
        const authorizedTransitionDigest = digestAuthorizedPsbtFinalization(
            artifact.envelopeDigest,
            artifact.sourceOperationDigest,
            finalizedTransactionDigest,
        );
        if (
            artifact.kind !== 'signer-issued-bitcoin-broadcast'
            || artifact.envelopeDigest !== record.envelopeDigest
            || artifact.envelopeDigest !== authorization.envelopeDigest
            || artifact.sourceOperationDigest !== record.sourceOperationDigest
            || artifact.sourceOperationDigest !== authorization.envelope.canonicalOperationDigest
            || artifact.transactionHex !== record.transactionHex
            || artifact.transactionHexDigest !== record.transactionHexDigest
            || artifact.transactionHexDigest !== transactionHexDigest
            || artifact.finalizedTransactionDigest !== record.finalizedTransactionDigest
            || artifact.finalizedTransactionDigest !== finalizedTransactionDigest
            || artifact.authorizedTransitionDigest !== record.authorizedTransitionDigest
            || artifact.authorizedTransitionDigest !== authorizedTransitionDigest
        ) {
            return Object.freeze({ kind: 'rejected', reason: 'broadcast_digest_mismatch' });
        }
        return Object.freeze({
            kind: 'validated',
            transactionHex,
            envelopeDigest: record.envelopeDigest,
            sourceOperationDigest: record.sourceOperationDigest,
            transactionHexDigest: record.transactionHexDigest,
            finalizedTransactionDigest: record.finalizedTransactionDigest,
            authorizedTransitionDigest: record.authorizedTransitionDigest,
        });
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'broadcast_digest_mismatch' });
    }
}

/**
* Native-only value-bearing PSBT signing boundary. It consumes the exact gate
* authorization immediately before the native batch signing call and has no
* browser/software fallback.
*/
export async function signAuthorizedValueOperationNative(
    request: NativeValueSigningRequest,
): Promise<NativeValueSigningOutcome> {
    let normalizedPsbt: string;
    try {
        normalizedPsbt = createBitcoinPsbtOperationPayload(request.psbt).psbt;
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
    }
    const { authorization } = request;
    const authorizationMatchesArtifact = (() => {
        try {
            return authorization.envelopeDigest === authorization.capability.envelopeDigest
                && digestValueOperationEnvelope(authorization.envelope) === authorization.envelopeDigest
                && digestBitcoinPsbtOperation(normalizedPsbt) === authorization.envelope.canonicalOperationDigest;
        } catch {
            return false;
        }
    })();
    if (!authorizationMatchesArtifact) {
        return Object.freeze({ kind: 'rejected', reason: 'mismatched_authorization' });
    }
    if (!Capacitor.isNativePlatform()) {
        return Object.freeze({ kind: 'unsupported', reason: 'non_native_platform' });
    }
    if (!request.vault) {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
    }

    const path = request.derivationPath ?? "m/84'/0'/0'/0/0";
    let pubkey: string;
    let hashes: ReturnType<typeof getPsbtSighashes>;
    let unsignedTransaction: string;
    try {
        const identity = await getPublicKeyNative({ vault: request.vault, path, network: request.network });
        pubkey = identity.pubkey;
    } catch {
        return Object.freeze({ kind: 'unsupported', reason: 'native_enclave_unavailable' });
    }
    if (!isValidPublicKey(pubkey)) {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
    }
    try {
        hashes = getPsbtSighashes(normalizedPsbt, Buffer.from(pubkey, 'hex'), request.network);
        unsignedTransaction = getUnsignedTxHex(normalizedPsbt, request.network);
        if (hashes.length === 0 || !isValidHex(unsignedTransaction, 1)) {
            return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
        }
        const parsedTransaction = bitcoin.Transaction.fromHex(unsignedTransaction);
        if (parsedTransaction.ins.length === 0 || parsedTransaction.outs.length === 0) {
            return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
        }
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
    }

    const nativeRequest = Object.freeze({
        vault: request.vault,
        path,
        hashes: hashes.map(({ hash }) => hash.toString('hex')),
        network: request.network,
        payload: unsignedTransaction,
    });
    const stage = consumeAuthorizedValueOperationStage(authorization, 'sign', authorization.envelopeDigest);
    if (stage.kind === 'rejected') return stage;

    try {
        const nativeResult = await GateBoundValueSigner.signBatch(nativeRequest);
        if (nativeResult.signatures.length !== hashes.length) {
            return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
        }
        const signatures = nativeResult.signatures.map((entry, index) => {
            if (!isValidHex(entry.signature, 64)) throw new Error('invalid signature');
            return { index: hashes[index].index, signature: Buffer.from(entry.signature, 'hex') };
        });
        const broadcastReadyHex = finalizePsbtWithSigs(
            normalizedPsbt,
            signatures,
            Buffer.from(pubkey, 'hex'),
            request.network,
        );
        if (!isValidHex(broadcastReadyHex, 1)) {
            return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
        }
        const broadcastArtifact = issueBitcoinBroadcastArtifact(authorization, broadcastReadyHex);
        return Object.freeze({
            kind: 'signed',
            signature: nativeResult.signatures[0].signature,
            pubkey,
            broadcastReadyHex: broadcastArtifact.transactionHex,
            broadcastArtifact,
            timestamp: Date.now(),
        });
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'native_signing_failed' });
    }
}
