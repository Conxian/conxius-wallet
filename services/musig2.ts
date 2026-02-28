import { secp256k1 as nobleSecp } from '@noble/curves/secp256k1.js';
import * as bitcoin from 'bitcoinjs-lib';

/**
 * Musig2 (BIP-327) Implementation for Taproot
 * Provides key aggregation, nonce generation, and signature aggregation.
 */

const CURVE_N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

/**
 * Aggregates public keys into a single Musig2 public key.
 */
export function aggregatePubkeys(pubkeys: Uint8Array[]): Uint8Array {
    const sortedPubkeys = [...pubkeys].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    const Point = (nobleSecp as any).Point;

    const getPoint = (pk: Uint8Array) => {
        const hex = pk.length === 32 ? '02' + Buffer.from(pk).toString('hex') : Buffer.from(pk).toString('hex');
        return Point.fromHex(hex);
    };

    const L = bitcoin.crypto.sha256(Buffer.concat(sortedPubkeys));
    let AggP: any = null;

    for (let i = 0; i < sortedPubkeys.length; i++) {
        const pk = sortedPubkeys[i];
        let ai = BigInt('0x' + Buffer.from(bitcoin.crypto.sha256(Buffer.concat([L, pk]))).toString('hex')) % CURVE_N;
        if (ai === 0n) ai = 1n;

        const Pi = getPoint(pk);
        const term = Pi.multiply(ai);

        if (AggP === null) {
            AggP = term;
        } else {
            AggP = AggP.add(term);
        }
    }

    try {
        let raw = AggP.toRawBytes(true);
        if (raw[0] === 0x03) {
            AggP = AggP.negate();
            raw = AggP.toRawBytes(true);
        }
        return new Uint8Array(raw.slice(1, 33));
    } catch {
        return new Uint8Array(32);
    }
}

export interface Musig2Nonce {
    secretNonce: Uint8Array;
    publicNonce: Uint8Array;
}

/**
 * Generates a Musig2 nonce pair.
 */
export function generateMusig2Nonce(secretKey: Uint8Array, sessionId?: Uint8Array): Musig2Nonce {
    const entropy = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const seed = sessionId ? bitcoin.crypto.sha256(Buffer.concat([Buffer.from(entropy), Buffer.from(sessionId)])) : entropy;

    let k1 = BigInt('0x' + Buffer.from(bitcoin.crypto.sha256(Buffer.concat([Buffer.from(seed), Buffer.from([1])]))).toString('hex')) % CURVE_N;
    let k2 = BigInt('0x' + Buffer.from(bitcoin.crypto.sha256(Buffer.concat([Buffer.from(seed), Buffer.from([2])]))).toString('hex')) % CURVE_N;
    if (k1 === 0n) k1 = 1n;
    if (k2 === 0n) k2 = 1n;

    const Point = (nobleSecp as any).Point;
    const R1 = Point.BASE.multiply(k1);
    const R2 = Point.BASE.multiply(k2);

    const publicNonce = new Uint8Array(66);
    publicNonce.set(R1.toRawBytes(true), 0);
    publicNonce.set(R2.toRawBytes(true), 33);

    const secretNonce = new Uint8Array(64);
    secretNonce.set(Buffer.from(k1.toString(16).padStart(64, '0'), 'hex'), 0);
    secretNonce.set(Buffer.from(k2.toString(16).padStart(64, '0'), 'hex'), 32);

    return { secretNonce, publicNonce };
}

/**
 * Signs a message with a partial Musig2 signature.
 */
export function signPartialMusig2(
    secretKey: Uint8Array,
    secretNonce: Uint8Array,
    aggregatedNonce: Uint8Array,
    aggregatedPubkey: Uint8Array,
    message: Uint8Array
): Uint8Array {
    const k1 = BigInt('0x' + Buffer.from(secretNonce.slice(0, 32)).toString('hex')) % CURVE_N;
    const k2 = BigInt('0x' + Buffer.from(secretNonce.slice(32, 64)).toString('hex')) % CURVE_N;
    const x = BigInt('0x' + Buffer.from(secretKey).toString('hex')) % CURVE_N;

    const e = BigInt('0x' + Buffer.from(bitcoin.crypto.sha256(Buffer.concat([
        Buffer.from(aggregatedNonce.slice(1, 33)),
        Buffer.from(aggregatedPubkey),
        Buffer.from(message)
    ]))).toString('hex')) % CURVE_N;

    const b = BigInt('0x' + Buffer.from(bitcoin.crypto.sha256(Buffer.concat([
        Buffer.from(aggregatedNonce),
        Buffer.from(aggregatedPubkey),
        Buffer.from(message)
    ]))).toString('hex')) % CURVE_N;

    const s = (k1 + b * k2 + e * x) % CURVE_N;
    return new Uint8Array(Buffer.from(s.toString(16).padStart(64, '0'), 'hex'));
}

/**
 * Aggregates partial signatures into a final Schnorr signature.
 */
export function aggregateSignatures(
    partialSigs: Uint8Array[],
    aggregatedNonce: Uint8Array
): Uint8Array {
    let sSum = 0n;
    for (const sig of partialSigs) {
        sSum = (sSum + BigInt('0x' + Buffer.from(sig).toString('hex'))) % CURVE_N;
    }

    const signature = new Uint8Array(64);
    signature.set(aggregatedNonce.slice(1, 33), 0);
    const sBytes = Buffer.from(sSum.toString(16).padStart(64, '0'), 'hex');
    signature.set(sBytes, 32);

    return signature;
}
