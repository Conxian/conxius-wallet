import { secp256k1 } from '@noble/curves/secp256k1.js';

/**
 * ECC Engine Fusion
 * Uses @noble/curves for high-speed point arithmetic and Taproot tweaking.
 */

/**
 * Tweaks a public key for Taproot.
 * Uses BigInt-level coordinate access (hasEvenY).
 */
export function tweakTaprootPubkey(publicKey: Uint8Array, tweak: Uint8Array): Uint8Array {
    const P = secp256k1.ProjectivePoint.fromHex(
        publicKey.length === 32
            ? '02' + Buffer.from(publicKey).toString('hex')
            : Buffer.from(publicKey).toString('hex')
    );

    const t = BigInt('0x' + Buffer.from(tweak).toString('hex'));
    const Q = P.add(secp256k1.ProjectivePoint.BASE.multiply(t));

    // Taproot uses the x-only pubkey
    return Q.toRawBytes().slice(1, 33);
}

/**
 * Returns true if the point has an even Y coordinate.
 * Equivalent to secp256k1_extrakeys_pubkey_parse in libsecp256k1.
 */
export function hasEvenY(publicKey: Uint8Array): boolean {
    const P = secp256k1.ProjectivePoint.fromHex(
        publicKey.length === 32
            ? '02' + Buffer.from(publicKey).toString('hex')
            : Buffer.from(publicKey).toString('hex')
    );
    return P.y % 2n === 0n;
}
