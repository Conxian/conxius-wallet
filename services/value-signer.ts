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

export interface SignedBitcoinValueOperation {
    readonly kind: 'signed-bitcoin-value-operation';
    readonly transactionHex: string;
    readonly transactionDigest: string;
    readonly network: Network;
}

export interface NativeValueSigningRequest {
    readonly authorization: AuthorizedValueOperation;
    readonly psbt: string;
    readonly network: Network;
    /** Opaque native wallet record identifier. Never pass seed or mnemonic material. */
    readonly vault: string;
    readonly derivationPath?: string;
}

export type NativeValueSigningOutcome =
    | Readonly<{
        kind: 'signed';
        signature: string;
        pubkey: string;
        signed: SignedBitcoinValueOperation;
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

interface BitcoinTransactionIntent {
    readonly version: number;
    readonly locktime: number;
    readonly inputs: readonly Readonly<{
        outpointHash: string;
        outpointIndex: number;
        sequence: number;
    }>[];
    readonly outputs: readonly Readonly<{
        script: string;
        amountSats: string;
    }>[];
}

interface SignedBitcoinValueOperationRecord {
    readonly authorization: AuthorizedValueOperation;
    readonly capability: AuthorizedValueOperation['capability'];
    readonly envelopeDigest: string;
    readonly authorizedPsbtDigest: string;
    readonly psbt: string;
    readonly unsignedTransactionDigest: string;
    readonly unsignedTransactionIntent: BitcoinTransactionIntent;
    readonly finalTransactionDigest: string;
    readonly network: Network;
}

export type SignedBitcoinLineageRejectionReason =
    | 'invalid_signed_artifact'
    | 'unregistered_signed_artifact'
    | 'mismatched_authorization'
    | 'psbt_digest_mismatch'
    | 'transaction_digest_mismatch'
    | 'transaction_intent_mismatch'
    | 'network_mismatch';

export type SignedBitcoinLineageOutcome =
    | Readonly<{ kind: 'validated'; envelopeDigest: string; transactionDigest: string }>
    | Readonly<{ kind: 'rejected'; reason: SignedBitcoinLineageRejectionReason }>;

const signedBitcoinValueOperationRegistry = new WeakMap<object, SignedBitcoinValueOperationRecord>();

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

function bitcoinTransactionIntent(transactionHex: string): BitcoinTransactionIntent {
    const transaction = bitcoin.Transaction.fromHex(transactionHex);
    if (transaction.ins.length === 0 || transaction.outs.length === 0) {
        throw new Error('Bitcoin transaction intent must contain inputs and outputs.');
    }
    return Object.freeze({
        version: transaction.version,
        locktime: transaction.locktime,
        inputs: Object.freeze(transaction.ins.map((input) => Object.freeze({
            outpointHash: Buffer.from(input.hash).toString('hex'),
            outpointIndex: input.index,
            sequence: input.sequence,
        }))),
        outputs: Object.freeze(transaction.outs.map((output) => Object.freeze({
            script: Buffer.from(output.script).toString('hex'),
            amountSats: output.value.toString(),
        }))),
    });
}

function transactionIntentDigest(intent: BitcoinTransactionIntent): string {
    return digestCanonicalPayload({
        kind: 'bitcoin-unsigned-transaction-intent',
        version: intent.version,
        locktime: intent.locktime,
        inputs: intent.inputs,
        outputs: intent.outputs,
    });
}

function signedTransactionDigest(transactionHex: string, network: Network): string {
    return digestCanonicalPayload({ kind: 'bitcoin-final-transaction', transactionHex, network });
}

function sameTransactionIntent(left: BitcoinTransactionIntent, right: BitcoinTransactionIntent): boolean {
    return transactionIntentDigest(left) === transactionIntentDigest(right);
}

function isExactSignedBitcoinValueOperation(value: unknown): value is SignedBitcoinValueOperation {
    if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 4 || keys.some((key) => typeof key !== 'string')) return false;
    if (!['kind', 'transactionHex', 'transactionDigest', 'network'].every((key) => Object.hasOwn(value, key))) return false;
    const candidate = value as Partial<SignedBitcoinValueOperation>;
    return candidate.kind === 'signed-bitcoin-value-operation'
        && isValidHex(candidate.transactionHex, 1)
        && typeof candidate.transactionDigest === 'string'
        && /^[0-9a-f]{64}$/.test(candidate.transactionDigest)
        && (candidate.network === 'mainnet' || candidate.network === 'testnet');
}

/**
* Validates a signer-produced artifact against its module-private provenance.
* Object copies, spreads, and structural lookalikes are intentionally rejected.
*/
export function validateSignedBitcoinValueOperationLineage(
    authorization: AuthorizedValueOperation,
    signed: SignedBitcoinValueOperation,
): SignedBitcoinLineageOutcome {
    if (!isExactSignedBitcoinValueOperation(signed)) {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_signed_artifact' });
    }
    const record = signedBitcoinValueOperationRegistry.get(signed);
    if (!record) return Object.freeze({ kind: 'rejected', reason: 'unregistered_signed_artifact' });
    if (authorization !== record.authorization || authorization.capability !== record.capability) {
        return Object.freeze({ kind: 'rejected', reason: 'mismatched_authorization' });
    }
    if (
        authorization.envelopeDigest !== record.envelopeDigest
        || authorization.capability.envelopeDigest !== record.envelopeDigest
    ) {
        return Object.freeze({ kind: 'rejected', reason: 'mismatched_authorization' });
    }
    if (authorization.envelope.network !== record.network || signed.network !== record.network) {
        return Object.freeze({ kind: 'rejected', reason: 'network_mismatch' });
    }
    let retainedPsbtDigest: string;
    let retainedUnsignedIntent: BitcoinTransactionIntent;
    try {
        retainedPsbtDigest = digestBitcoinPsbtOperation(record.psbt);
        retainedUnsignedIntent = bitcoinTransactionIntent(getUnsignedTxHex(record.psbt, record.network));
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'psbt_digest_mismatch' });
    }
    if (
        retainedPsbtDigest !== record.authorizedPsbtDigest
        || retainedPsbtDigest !== authorization.envelope.canonicalOperationDigest
        || transactionIntentDigest(retainedUnsignedIntent) !== record.unsignedTransactionDigest
        || !sameTransactionIntent(retainedUnsignedIntent, record.unsignedTransactionIntent)
    ) {
        return Object.freeze({ kind: 'rejected', reason: 'psbt_digest_mismatch' });
    }
    const expectedFinalDigest = signedTransactionDigest(signed.transactionHex, signed.network);
    if (signed.transactionDigest !== record.finalTransactionDigest || expectedFinalDigest !== record.finalTransactionDigest) {
        return Object.freeze({ kind: 'rejected', reason: 'transaction_digest_mismatch' });
    }
    try {
        if (!sameTransactionIntent(bitcoinTransactionIntent(signed.transactionHex), record.unsignedTransactionIntent)) {
            return Object.freeze({ kind: 'rejected', reason: 'transaction_intent_mismatch' });
        }
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_signed_artifact' });
    }
    return Object.freeze({
        kind: 'validated',
        envelopeDigest: record.envelopeDigest,
        transactionDigest: record.finalTransactionDigest,
    });
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
                && digestBitcoinPsbtOperation(normalizedPsbt) === authorization.envelope.canonicalOperationDigest
                && authorization.envelope.network === request.network;
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
    let unsignedTransactionIntent: BitcoinTransactionIntent;
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
        unsignedTransactionIntent = bitcoinTransactionIntent(unsignedTransaction);
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
        const transactionHex = finalizePsbtWithSigs(
            normalizedPsbt,
            signatures,
            Buffer.from(pubkey, 'hex'),
            request.network,
        );
        if (!isValidHex(transactionHex, 1)) {
            return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
        }
        const normalizedTransactionHex = transactionHex.toLowerCase();
        const finalTransactionIntent = bitcoinTransactionIntent(normalizedTransactionHex);
        if (!sameTransactionIntent(unsignedTransactionIntent, finalTransactionIntent)) {
            return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
        }
        const transactionDigest = signedTransactionDigest(normalizedTransactionHex, request.network);
        const signed = Object.freeze({
            kind: 'signed-bitcoin-value-operation' as const,
            transactionHex: normalizedTransactionHex,
            transactionDigest,
            network: request.network,
        });
        signedBitcoinValueOperationRegistry.set(signed, Object.freeze({
            authorization,
            capability: authorization.capability,
            envelopeDigest: authorization.envelopeDigest,
            authorizedPsbtDigest: authorization.envelope.canonicalOperationDigest,
            psbt: normalizedPsbt,
            unsignedTransactionDigest: transactionIntentDigest(unsignedTransactionIntent),
            unsignedTransactionIntent,
            finalTransactionDigest: transactionDigest,
            network: request.network,
        }));
        return Object.freeze({
            kind: 'signed',
            signature: nativeResult.signatures[0].signature,
            pubkey,
            signed,
            timestamp: Date.now(),
        });
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'native_signing_failed' });
    }
}
