import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { bech32m } from 'bech32';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Buffer } from 'buffer';
import type {
    SilentPaymentNetwork,
    SilentPaymentScanMetrics,
    SilentPaymentScanOptions,
    SilentPaymentScanState,
    SilentPaymentUtxo,
} from '../types';

const bip32 = BIP32Factory(ecc);
const PUBLIC_KEY_BYTES = 33;
const MAX_SCAN_BLOCKS = 2_016;
const SILENT_PAYMENT_NETWORKS: SilentPaymentNetwork[] = ['mainnet', 'testnet', 'signet', 'regtest'];

function validateCompressedPublicKey(publicKey: Uint8Array, name: string): void {
    if (publicKey.length !== PUBLIC_KEY_BYTES) {
        throw new Error(`Invalid ${name} public key length`);
    }
    if (publicKey[0] !== 0x02 && publicKey[0] !== 0x03) {
        throw new Error(`Invalid ${name} compressed public key prefix`);
    }
    if (!ecc.isPointCompressed(publicKey)) {
        throw new Error(`Invalid ${name} compressed public key point`);
    }
}

export interface SilentPaymentKeys {
    scanPub: Buffer;
    spendPub: Buffer;
}

export interface SilentPaymentScanResult {
    utxos: SilentPaymentUtxo[];
    metrics: SilentPaymentScanMetrics;
    cursor?: {
        network: SilentPaymentNetwork;
        lastScannedHeight: number;
        lastScannedBlockHash: string;
    };
}

export interface SilentPaymentPluginContract {
    scanForPayments(options: SilentPaymentScanOptions): Promise<SilentPaymentScanResult>;
    cancelScan(): Promise<SilentPaymentScanState>;
    getScanStatus(): Promise<SilentPaymentScanState>;
}

export const SilentPaymentPlugin = registerPlugin<SilentPaymentPluginContract>('SilentPayment');

/** Derives only public receiver keys for legacy display/address tooling. */
export const deriveSilentPaymentKeys = (
    seed: Buffer,
    network: 'mainnet' | 'testnet' | 'signet' | 'regtest' = 'mainnet',
): SilentPaymentKeys => {
    const root = bip32.fromSeed(seed);
    const coinType = network === 'mainnet' ? 0 : 1;
    const scanNode = root.derivePath(`m/352'/${coinType}'/0'/1'/0`);
    const spendNode = root.derivePath(`m/352'/${coinType}'/0'/0'/0`);

    return {
        scanPub: Buffer.from(scanNode.publicKey),
        spendPub: Buffer.from(spendNode.publicKey),
    };
};

/**
* Encodes the public BIP-352 receiver address; no native secret boundary is involved. The
* current shipped Compose launcher cannot call the Capacitor plugin, so this codec is not a claim
* of full end-to-end TypeScript runtime support.
*/
export const encodeSilentPaymentAddress = async (
    scanPub: Buffer,
    spendPub: Buffer,
    network: 'mainnet' | 'testnet' | 'signet' | 'regtest' = 'mainnet',
): Promise<string> => {
    validateCompressedPublicKey(scanPub, 'scan');
    validateCompressedPublicKey(spendPub, 'spend');
    const hrp = network === 'mainnet' ? 'sp' : 'tsp';
    const fullCombined = Buffer.concat([scanPub, spendPub]);
    const words = bech32m.toWords(fullCombined);
    return bech32m.encode(hrp, [0, ...words], 1024);
};

/** Decodes and validates the public BIP-352 receiver address shape. */
export const decodeSilentPaymentAddress = (address: string) => {
    const decoded = bech32m.decode(address, 1024);
    const version = decoded.words[0];
    const data = bech32m.fromWords(decoded.words.slice(1));
    if (version !== 0 || data.length !== PUBLIC_KEY_BYTES * 2) {
        throw new Error('Invalid silent-payment address payload');
    }
    if (decoded.prefix !== 'sp' && decoded.prefix !== 'tsp') {
        throw new Error('Unsupported silent-payment address network');
    }
    const scanPub = Buffer.from(data.slice(0, PUBLIC_KEY_BYTES));
    const spendPub = Buffer.from(data.slice(PUBLIC_KEY_BYTES));
    validateCompressedPublicKey(scanPub, 'scan');
    validateCompressedPublicKey(spendPub, 'spend');
    return {
        hrp: decoded.prefix,
        version,
        scanPub,
        spendPub,
    };
};

/** Secret-free native scan entry point. Web scanning fails explicitly. */
export async function scanForSilentPayments(options: SilentPaymentScanOptions): Promise<SilentPaymentScanResult>;
/** Compatibility overload; it still sends only public options. */
export async function scanForSilentPayments(
    startHeight: number,
    endHeight: number,
    network?: SilentPaymentNetwork,
): Promise<SilentPaymentScanResult>;
export async function scanForSilentPayments(
    optionsOrStart: SilentPaymentScanOptions | number,
    legacyEndHeight?: number,
    legacyNetwork: SilentPaymentNetwork = 'mainnet',
): Promise<SilentPaymentScanResult> {
    const options: SilentPaymentScanOptions = typeof optionsOrStart === 'number'
        ? { network: legacyNetwork, startHeight: optionsOrStart, endHeight: legacyEndHeight ?? -1 }
        : optionsOrStart;
    validateScanOptions(options);
    if (!Capacitor.isNativePlatform()) {
        throw new Error('Silent-payment scanning is unsupported on the web platform.');
    }
    try {
        const result = await SilentPaymentPlugin.scanForPayments(options);
        return normalizeScanResult(result);
    } catch (error) {
        throw mapSilentPaymentError(error);
    }
}

export async function cancelSilentPaymentScan(): Promise<SilentPaymentScanState> {
    if (!Capacitor.isNativePlatform()) {
        throw new Error('Silent-payment scanning is unsupported on the web platform.');
    }
    try {
        return normalizeScanStatus(await SilentPaymentPlugin.cancelScan());
    } catch (error) {
        throw mapSilentPaymentError(error);
    }
}

export async function getSilentPaymentScanStatus(): Promise<SilentPaymentScanState> {
    if (!Capacitor.isNativePlatform()) {
        throw new Error('Silent-payment scanning is unsupported on the web platform.');
    }
    try {
        return normalizeScanStatus(await SilentPaymentPlugin.getScanStatus());
    } catch (error) {
        throw mapSilentPaymentError(error);
    }
}

export function dedupeSilentPaymentUtxos(utxos: SilentPaymentUtxo[]): SilentPaymentUtxo[] {
    const byOutpoint = new Map<string, SilentPaymentUtxo>();
    for (const utxo of utxos) {
        if (!utxo || !SILENT_PAYMENT_NETWORKS.includes(utxo.network)) continue;
        if (!utxo || typeof utxo.txid !== 'string' || !/^[0-9a-fA-F]{64}$/.test(utxo.txid)) continue;
        if (!Number.isSafeInteger(utxo.vout) || utxo.vout < 0 || utxo.vout > 0xffffffff) continue;
        if (!Number.isSafeInteger(utxo.valueSat) || utxo.valueSat < 0 || utxo.valueSat > 2_100_000_000_000_000) continue;
        if (!Number.isSafeInteger(utxo.blockHeight) || utxo.blockHeight < 0) continue;
        if (!Number.isSafeInteger(utxo.transactionIndex) || utxo.transactionIndex < 0 || utxo.transactionIndex > 0xffffffff) continue;
        if (typeof utxo.outputKeyHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(utxo.outputKeyHex)) continue;
        if (typeof utxo.outpoint !== 'string') continue;
        if (utxo.source !== 'esplora') continue;
        if (!['UNSPENT', 'SPENT', 'UNKNOWN'].includes(utxo.spentState)) continue;
        if (typeof utxo.spentnessKnown !== 'boolean' || typeof utxo.matchedNegatedOutputKey !== 'boolean') continue;
        if (!['UNLABELED', 'LABEL'].includes(utxo.matchKind)) continue;
        if (utxo.matchKind === 'UNLABELED' && utxo.labelIndex != null) continue;
        if (utxo.matchKind === 'LABEL'
            && (!Number.isSafeInteger(utxo.labelIndex) || utxo.labelIndex! < 0 || utxo.labelIndex! > 0xffffffff)) continue;
        if (utxo.spentState === 'UNKNOWN' && utxo.spentnessKnown) continue;
        if (utxo.spentState !== 'UNKNOWN' && !utxo.spentnessKnown) continue;
        const txid = utxo.txid.toLowerCase();
        const canonicalOutpoint = `${txid}:${utxo.vout}`;
        if (utxo.outpoint.toLowerCase() !== canonicalOutpoint) continue;
        const key = `${utxo.network}:${canonicalOutpoint}`;
        byOutpoint.set(key, {
            ...utxo,
            txid,
            outpoint: canonicalOutpoint,
            outputKeyHex: utxo.outputKeyHex.toLowerCase(),
        });
    }
    return [...byOutpoint.values()];
}

function normalizeScanResult(result: SilentPaymentScanResult): SilentPaymentScanResult {
    if (!result || !Array.isArray(result.utxos) || !result.metrics) {
        throw new Error('INVALID_PUBLIC_RESULT');
    }
    return {
        ...result,
        metrics: normalizeScanMetrics(result.metrics),
        cursor: result.cursor == null ? undefined : normalizeScanCursor(result.cursor),
        utxos: dedupeSilentPaymentUtxos(result.utxos),
    };
}

function normalizeScanMetrics(metrics: unknown): SilentPaymentScanMetrics {
    if (!metrics || typeof metrics !== 'object') throw new Error('INVALID_PUBLIC_RESULT');
    const candidate = metrics as Partial<SilentPaymentScanMetrics>;
    const required = [candidate.scannedBlocks, candidate.scannedTransactions, candidate.skippedTransactions, candidate.matchCount];
    if (!required.every(value => Number.isSafeInteger(value) && (value as number) >= 0)) {
        throw new Error('INVALID_PUBLIC_RESULT');
    }
    for (const value of [candidate.currentHeight, candidate.currentTipHeight]) {
        if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
            throw new Error('INVALID_PUBLIC_RESULT');
        }
    }
    return candidate as SilentPaymentScanMetrics;
}

function normalizeScanCursor(cursor: unknown): NonNullable<SilentPaymentScanResult['cursor']> {
    if (!cursor || typeof cursor !== 'object') throw new Error('INVALID_PUBLIC_RESULT');
    const candidate = cursor as Partial<NonNullable<SilentPaymentScanResult['cursor']>>;
    if (!SILENT_PAYMENT_NETWORKS.includes(candidate.network as SilentPaymentNetwork)
        || !Number.isSafeInteger(candidate.lastScannedHeight)
        || (candidate.lastScannedHeight as number) < 0
        || typeof candidate.lastScannedBlockHash !== 'string'
        || !/^[0-9a-f]{64}$/.test(candidate.lastScannedBlockHash)
    ) {
        throw new Error('INVALID_PUBLIC_RESULT');
    }
    return candidate as NonNullable<SilentPaymentScanResult['cursor']>;
}

function normalizeScanStatus(
    status: SilentPaymentScanState & { result?: SilentPaymentScanResult },
): SilentPaymentScanState {
    if (!status || typeof status.status !== 'string') {
        throw new Error('INVALID_PUBLIC_RESULT');
    }
    if (status.status === 'completed') {
        const result = normalizeScanResult(status.result ?? {
            utxos: status.utxos,
            metrics: status.metrics,
            cursor: status.cursor,
        });
        return {
            status: 'completed',
            metrics: result.metrics,
            cursor: result.cursor,
            utxos: result.utxos,
        };
    }
    return status;
}

function validateScanOptions(options: SilentPaymentScanOptions): void {
    if (!options || !['mainnet', 'testnet', 'signet', 'regtest'].includes(options.network)) {
        throw new Error('INVALID_REQUEST');
    }
    if (!Number.isSafeInteger(options.endHeight) || options.endHeight < 0) {
        throw new Error('INVALID_REQUEST');
    }
    if (options.startHeight != null &&
        (!Number.isSafeInteger(options.startHeight) || options.startHeight < 0 || options.startHeight > options.endHeight)) {
        throw new Error('INVALID_REQUEST');
    }
    if (options.startHeight != null && options.endHeight - options.startHeight >= MAX_SCAN_BLOCKS) {
        throw new Error('RESOURCE_LIMIT');
    }
}

function mapSilentPaymentError(error: unknown): Error {
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: unknown }).message)
            : '';
    const stableCodes = new Set([
        'INVALID_SECRET',
        'INVALID_NETWORK',
        'INVALID_PUBLIC_BATCH',
        'RESOURCE_LIMIT',
        'INVALID_PUBLIC_RECORD',
        'ECC_FAILURE',
        'INTERNAL',
        'CANCELLED',
        'REORG_DETECTED',
        'WALLET_LOCKED',
        'INVALID_REQUEST',
        'NETWORK_UNAVAILABLE',
        'UNSUPPORTED_PLATFORM',
        'LIBRARY_UNAVAILABLE',
    ]);
    const stable = stableCodes.has(code) ? code : 'INTERNAL';
    return new Error(stable);
}
