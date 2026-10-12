import { secp256k1 as nobleSecp, schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * ECC Engine Fusion
 * Uses @noble/curves for high-speed point arithmetic and Taproot tweaking.
 */

/**
 * Computes a BIP-340/341 Tagged Hash.
 * TaggedHash(tag, msg) = SHA256(SHA256(tag) || SHA256(tag) || msg)
 */
export function taggedHash(tag: string, data: Uint8Array): Uint8Array {
    const tagHash = sha256(Buffer.from(tag, 'utf8'));
    const buffer = new Uint8Array(tagHash.length * 2 + data.length);
    buffer.set(tagHash, 0);
    buffer.set(tagHash, tagHash.length);
    buffer.set(data, tagHash.length * 2);
    return sha256(buffer);
}

/**
 * Computes BIP-341 TapTweak hash for a given internal x-only public key and optional merkle root.
 * TapTweak = TaggedHash("TapTweak", P || merkleRoot)
 */
export function computeTapTweak(internalPubKey: Uint8Array, merkleRoot?: Uint8Array): Uint8Array {
    const pubKeyX = internalPubKey.length === 32 ? internalPubKey : internalPubKey.slice(1, 33);
    const data = new Uint8Array(32 + (merkleRoot ? merkleRoot.length : 0));
    data.set(pubKeyX, 0);
    if (merkleRoot) {
        data.set(merkleRoot, 32);
    }
    return taggedHash('TapTweak', data);
}

/**
 * Tweaks a public key for Taproot following BIP-341.
 * Handles x-only public keys, tweaking, and coordinate parity.
 */
export function tweakTaprootPubkey(publicKey: Uint8Array, tweak: Uint8Array): Uint8Array {
    const Point = (nobleSecp as any).Point;
    const P = Point.fromHex(
        publicKey.length === 32
            ? '02' + Buffer.from(publicKey).toString('hex')
            : Buffer.from(publicKey).toString('hex')
    );

    const t = BigInt('0x' + Buffer.from(tweak).toString('hex'));
    const Q = P.add(Point.BASE.multiply(t));

    const raw = typeof Q.toBytes === 'function' ? Q.toBytes(true) : Q.toRawBytes(true);
    return raw.slice(1, 33);
}

/**
 * Returns true if the point has an even Y coordinate.
 */
export function hasEvenY(publicKey: Uint8Array): boolean {
    const Point = (nobleSecp as any).Point;
    const P = Point.fromHex(
        publicKey.length === 32
            ? '02' + Buffer.from(publicKey).toString('hex')
            : Buffer.from(publicKey).toString('hex')
    );
    const raw = typeof P.toBytes === 'function' ? P.toBytes(true) : P.toRawBytes(true);
    return raw[0] === 0x02;
}

/**
 * Signs a message hash using Schnorr signatures (BIP-340).
 */
export function signSchnorr(messageHash: Uint8Array, privateKey: Uint8Array): Uint8Array {
    return schnorr.sign(messageHash, privateKey);
}

/**
 * Verifies a Schnorr signature.
 */
export function verifySchnorr(signature: Uint8Array, messageHash: Uint8Array, publicKey: Uint8Array): boolean {
    return schnorr.verify(signature, messageHash, publicKey);
}
