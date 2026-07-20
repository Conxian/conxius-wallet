import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deriveSilentPaymentKeys, encodeSilentPaymentAddress, scanForSilentPayments } from '../services/silent-payments';
import { Buffer } from 'buffer';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn()
    },
    registerPlugin: vi.fn(() => ({
        deriveSilentAddress: vi.fn().mockResolvedValue({ address: 'sp1_native_test' }),
        scanForPayments: vi.fn().mockResolvedValue({ utxos: ['{"txid":"test","amount":1000}'] })
    }))
}));

describe('Silent Payments Service', () => {
    const mockSeed = Buffer.alloc(64).fill(0xac);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('derives canonical public receiver keys without exposing private keys', () => {
        const keys = deriveSilentPaymentKeys(mockSeed);
        expect(keys.scanPub).toBeDefined();
        expect(keys.spendPub).toBeDefined();
        expect('scanKey' in keys).toBe(false);
    });

    it('keeps public address encoding deterministic on native platforms', async () => {
        (Capacitor.isNativePlatform as any).mockReturnValue(true);
        const keys = deriveSilentPaymentKeys(mockSeed);
        const addr = await encodeSilentPaymentAddress(keys.scanPub, keys.spendPub);
        expect(addr).toContain('sp1');
    });

    it('uses JS fallback for address encoding when on web', async () => {
        (Capacitor.isNativePlatform as any).mockReturnValue(false);
        const keys = deriveSilentPaymentKeys(mockSeed);
        const addr = await encodeSilentPaymentAddress(keys.scanPub, keys.spendPub);
        expect(addr).toContain('sp1');
        expect(addr).not.toBe('sp1_native_test');
    });

    it('does not accept a scan secret from TypeScript native scanning', async () => {
        (Capacitor.isNativePlatform as any).mockReturnValue(true);
        await expect(scanForSilentPayments(100, 200)).rejects.toThrow(/no scan secret/i);
    });
});
