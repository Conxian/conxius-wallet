import { secp256k1 as nobleSecp, schnorr } from '@noble/curves/secp256k1.js';

/**
 * ECC Engine Fusion
 * Uses @noble/curves for high-speed point arithmetic and Taproot tweaking.
 */

/**
 * Tweaks a public key for Taproot.
 * Uses BigInt-level coordinate access (hasEvenY).
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

    return Q.toRawBytes(true).slice(1, 33);
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
    const raw = P.toRawBytes(true);
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
