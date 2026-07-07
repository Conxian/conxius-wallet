import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { bech32m } from 'bech32';
import { Buffer } from 'buffer';
import { Capacitor, registerPlugin } from '@capacitor/core';

const bip32 = BIP32Factory(ecc);
const CURVE_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

export interface SilentPaymentPlugin {
    deriveSilentAddress(options: { scanPk: string; spendPk: string }): Promise<{ address: string }>;
    scanForPayments(options: {
        scanSk: string;
        spendPk: string;
        startBlock: number;
        endBlock: number;
    }): Promise<{ utxos: string[] }>;
}

const SilentPayment = registerPlugin<SilentPaymentPlugin>('SilentPayment');

export interface SilentPaymentKeys {
    scanKey: Buffer;
    spendKey: Buffer;
    scanPub: Buffer;
    spendPub: Buffer;
}

/**
 * Derives Silent Payment keys based on BIP-352
 */
export const deriveSilentPaymentKeys = (seed: Buffer): SilentPaymentKeys => {
    const root = bip32.fromSeed(seed);
    const scanNode = root.derivePath("m/352'/0'/0'/10/0");
    const spendNode = root.derivePath("m/352'/0'/0'/10/1");

    return {
        scanKey: Buffer.from(scanNode.privateKey!),
        spendKey: Buffer.from(spendNode.privateKey!),
        scanPub: Buffer.from(scanNode.publicKey),
        spendPub: Buffer.from(spendNode.publicKey)
    };
};

/**
 * Encodes the Silent Payment address (sp1...)
 * Optimized: Uses native bridge if available.
 */
export const encodeSilentPaymentAddress = async (scanPub: Buffer, spendPub: Buffer, network: 'mainnet' | 'testnet' = 'mainnet'): Promise<string> => {
    if (Capacitor.isNativePlatform()) {
        try {
            const res = await SilentPayment.deriveSilentAddress({
                scanPk: scanPub.toString('hex'),
                spendPk: spendPub.toString('hex')
            });
            return res.address;
        } catch (e) {
            console.warn("Native SilentPayment derivation failed, falling back to JS", e);
        }
    }

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
 * Scans for incoming Silent Payments.
 * Optimized: Prefers native scanning for performance.
 */
export const scanForSilentPayments = async (
    scanSk: Buffer,
    spendPk: Buffer,
    startBlock: number,
    endBlock: number
): Promise<any[]> => {
    if (Capacitor.isNativePlatform()) {
        try {
            const res = await SilentPayment.scanForPayments({
                scanSk: scanSk.toString('hex'),
                spendPk: spendPk.toString('hex'),
                startBlock,
                endBlock
            });
            return res.utxos.map(u => JSON.parse(u));
        } catch (e) {
            console.error("Native SilentPayment scanning failed", e);
            throw new Error("Native scanning error", { cause: e });
        }
    }

    // JS Fallback or Web Simulation
    return [];
};
