import { Capacitor } from '@capacitor/core';
import { Buffer } from 'buffer';
import { getPublicKeyNative, signBatchNative } from './enclave-storage';
import { finalizePsbtWithSigs, getPsbtSighashes, getUnsignedTxHex } from './psbt';
import { digestValueOperationEnvelope } from './value-operation-gate';
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

export type NativeValueSigningOutcome =
    | Readonly<{
        kind: 'signed';
        signature: string;
        pubkey: string;
        broadcastReadyHex: string;
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

function isValidHex(value: unknown, minimumBytes: number): value is string {
    return typeof value === 'string'
        && value.length >= minimumBytes * 2
        && value.length % 2 === 0
        && HEX_PATTERN.test(value);
}

function isValidPublicKey(value: unknown): value is string {
    return isValidHex(value, 32) && [64, 66, 130].includes(value.length);
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

    const stage = consumeAuthorizedValueOperationStage(authorization, 'sign', authorization.envelopeDigest);
    if (stage.kind === 'rejected') return stage;

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
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_native_artifact' });
    }

    try {
        const nativeResult = await signBatchNative({
            vault: request.vault,
            path,
            hashes: hashes.map(({ hash }) => hash.toString('hex')),
            network: request.network,
            payload: unsignedTransaction,
        });
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
        return Object.freeze({
            kind: 'signed',
            signature: nativeResult.signatures[0].signature,
            pubkey,
            broadcastReadyHex,
            timestamp: Date.now(),
        });
    } catch {
        return Object.freeze({ kind: 'rejected', reason: 'native_signing_failed' });
    }
}
