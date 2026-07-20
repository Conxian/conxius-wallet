import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'buffer';
import { readFileSync } from 'node:fs';
import { Capacitor } from '@capacitor/core';
import {
    dedupeSilentPaymentUtxos,
    deriveSilentPaymentKeys,
    encodeSilentPaymentAddress,
    getSilentPaymentScanStatus,
    scanForSilentPayments,
    SilentPaymentPlugin,
} from '../services/silent-payments';
import type { SilentPaymentUtxo } from '../types';

const nativePlugin = vi.hoisted(() => ({
    scanForPayments: vi.fn(),
    cancelScan: vi.fn(),
    getScanStatus: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: vi.fn() },
    registerPlugin: vi.fn(() => nativePlugin),
}));

const publicUtxo: SilentPaymentUtxo = {
    network: 'mainnet' as const,
    outpoint: `${'00'.repeat(32)}:0`,
    txid: '00'.repeat(32),
    vout: 0,
    valueSat: 1000,
    outputKeyHex: 'aa'.repeat(32),
    blockHeight: 100,
    transactionIndex: 1,
    source: 'esplora',
    spentState: 'UNKNOWN',
    spentnessKnown: false,
    matchKind: 'UNLABELED',
    matchedNegatedOutputKey: false,
};

describe('Silent Payments service', () => {
    const mockSeed = Buffer.alloc(64).fill(0xac);

    beforeEach(() => {
        vi.clearAllMocks();
        (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(false);
        nativePlugin.scanForPayments.mockResolvedValue({
            utxos: [publicUtxo, publicUtxo],
            metrics: {
                scannedBlocks: 1,
                scannedTransactions: 1,
                skippedTransactions: 0,
                matchCount: 1,
            },
            cursor: {
                network: 'mainnet',
                lastScannedHeight: 100,
                lastScannedBlockHash: 'bb'.repeat(32),
            },
        });
    });

    it('derives canonical public receiver keys without exposing private keys', () => {
        const keys = deriveSilentPaymentKeys(mockSeed);
        expect(keys.scanPub.length).toBe(33);
        expect(keys.spendPub.length).toBe(33);
        expect('scanKey' in keys).toBe(false);
        expect('privateKey' in keys).toBe(false);
    });

    it('keeps public address encoding deterministic', async () => {
        const keys = deriveSilentPaymentKeys(mockSeed);
        const addr = await encodeSilentPaymentAddress(keys.scanPub, keys.spendPub);
        expect(addr).toContain('sp1');
    });

    it('calls native scanning with public options only and dedupes outpoints', async () => {
        (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const result = await scanForSilentPayments({ network: 'mainnet', startHeight: 99, endHeight: 100 });

        expect(nativePlugin.scanForPayments).toHaveBeenCalledWith({
            network: 'mainnet',
            startHeight: 99,
            endHeight: 100,
        });
        const requestJson = JSON.stringify(nativePlugin.scanForPayments.mock.calls[0][0]);
        expect(requestJson).not.toMatch(/mnemonic|passphrase|seed|private|xpriv|scanKey|spendKey/i);
        expect(result.utxos).toHaveLength(1);
        expect(JSON.stringify(result)).not.toMatch(/mnemonic|passphrase|seed|private|xpriv/i);
    });

    it('dedupes public UTXOs by canonical outpoint', () => {
        expect(dedupeSilentPaymentUtxos([publicUtxo, { ...publicUtxo, valueSat: 2000 }])).toEqual([
            { ...publicUtxo, valueSat: 2000 },
        ]);
        expect(dedupeSilentPaymentUtxos([{ ...publicUtxo, outpoint: 'invalid' }])).toEqual([]);
    });

    it('normalizes the Kotlin top-level completed status shape', async () => {
        (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);
        nativePlugin.getScanStatus.mockResolvedValue({
            status: 'completed',
            utxos: [publicUtxo, publicUtxo],
            metrics: { scannedBlocks: 1, scannedTransactions: 1, skippedTransactions: 0, matchCount: 1 },
        });

        await expect(getSilentPaymentScanStatus()).resolves.toMatchObject({
            status: 'completed',
            utxos: [publicUtxo],
        });
    });

    it('rejects unsupported web scanning explicitly', async () => {
        await expect(scanForSilentPayments({ network: 'mainnet', endHeight: 200 })).rejects.toThrow(
            /unsupported on the web platform/i,
        );
    });

    it('maps native failures to stable public error codes', async () => {
        (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);
        nativePlugin.scanForPayments.mockRejectedValue(new Error('stack trace and raw payload'));
        await expect(scanForSilentPayments({ network: 'mainnet', endHeight: 200 })).rejects.toThrow('INTERNAL');
    });

    it('does not serialize secret-bearing legacy fields', () => {
        expect(JSON.stringify(SilentPaymentPlugin)).not.toMatch(/mnemonic|passphrase|private|xpriv/i);
    });

    it('keeps the Room migration additive and public-only', () => {
        const migration = readFileSync('android/core-database/src/main/kotlin/com/conxius/wallet/database/AppDatabase.kt', 'utf8');
        const mapper = readFileSync('android/app/src/main/kotlin/com/conxius/wallet/repository/SilentPaymentPersistenceMapper.kt', 'utf8');

        expect(migration).toContain('Migration(2, 3)');
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS silent_payment_utxos');
        expect(migration).toContain('PRIMARY KEY(network, outpoint)');
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS silent_payment_scan_cursor');
        expect(migration).not.toContain('DROP TABLE');
        expect(mapper).toContain('source = "esplora"');
        expect(mapper).not.toMatch(/sharedSecret|privateTweak|scanKey|spendKey|xpriv/i);
    });

    it('does not retain the removed mock-seed UI path', () => {
        const component = readFileSync('components/SilentPayments.tsx', 'utf8');
        expect(component).not.toContain('Buffer.alloc(64)');
        expect(component).toContain('Address derivation is unavailable');
    });

    it('merges defaults when older persisted state lacks silent-payment fields', () => {
        const app = readFileSync('App.tsx', 'utf8');
        expect(app).toContain('normalizePersistedSilentPaymentScan');
        expect(app).toContain('decrypted.silentPaymentUtxos');
        expect(app).toContain("silentPaymentScan: { status: 'idle' }");
    });
});
