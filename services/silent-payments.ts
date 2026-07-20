import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { bech32m } from 'bech32';
import { Buffer } from 'buffer';
import { Capacitor } from '@capacitor/core';

const bip32 = BIP32Factory(ecc);
export interface SilentPaymentKeys {
    scanPub: Buffer;
    spendPub: Buffer;
}

/**
* Derives only public Silent Payment receiver keys for display/address encoding.
* Native scanning does not receive these values or any private key material.
 */
export const deriveSilentPaymentKeys = (seed: Buffer, network: 'mainnet' | 'testnet' = 'mainnet'): SilentPaymentKeys => {
    const root = bip32.fromSeed(seed);
    const coinType = network === 'mainnet' ? 0 : 1;
    const scanNode = root.derivePath(`m/352'/${coinType}'/0'/1'/0`);
    const spendNode = root.derivePath(`m/352'/${coinType}'/0'/0'/0`);

    return {
        scanPub: Buffer.from(scanNode.publicKey),
        spendPub: Buffer.from(spendNode.publicKey)
    };
};

/**
 * Encodes the Silent Payment address (sp1...)
* Native scanning is deliberately not involved in public address encoding.
 */
export const encodeSilentPaymentAddress = async (scanPub: Buffer, spendPub: Buffer, network: 'mainnet' | 'testnet' = 'mainnet'): Promise<string> => {
    const hrp = network === 'mainnet' ? 'sp' : 'tsp';
    const version = 0;
    const fullCombined = Buffer.concat([scanPub, spendPub]);
    const words = bech32m.toWords(fullCombined);
    return bech32m.encode(hrp, [version, ...words], 1024);
};

/**
 * Decodes a Silent Payment address
 */
export const decodeSilentPaymentAddress = (address: string) => {
    const decoded: any = bech32m.decode(address, 1024);
    const version = decoded.words[0];
    const data = bech32m.fromWords(decoded.words.slice(1));

    return {
        hrp: decoded.prefix || (decoded as any).hrp,
        version,
        scanPub: Buffer.from(data.slice(0, 33)),
        spendPub: Buffer.from(data.slice(33, 66))
    };
};

/**
* Native scanning is exposed through Kotlin BlockSource batches, not this TypeScript API.
 */
export const scanForSilentPayments = async (
    startBlock: number,
    endBlock: number
): Promise<any[]> => {
    if (Capacitor.isNativePlatform()) {
        throw new Error("Native silent-payment scanning requires a Kotlin BlockSource; no scan secret is accepted from TypeScript");
    }

    // Structured native scanning is intentionally not simulated on web.
    return [];
};
