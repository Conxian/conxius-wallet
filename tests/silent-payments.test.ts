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

    it('derives keys from seed', () => {
        const keys = deriveSilentPaymentKeys(mockSeed);
        expect(keys.scanKey).toBeDefined();
        expect(keys.spendKey).toBeDefined();
        expect(keys.scanPub).toBeDefined();
        expect(keys.spendPub).toBeDefined();
    });

    it('uses native bridge for address encoding when on native platform', async () => {
        (Capacitor.isNativePlatform as any).mockReturnValue(true);
        const keys = deriveSilentPaymentKeys(mockSeed);
        const addr = await encodeSilentPaymentAddress(keys.scanPub, keys.spendPub);
        expect(addr).toBe('sp1_native_test');
    });

    it('uses JS fallback for address encoding when on web', async () => {
        (Capacitor.isNativePlatform as any).mockReturnValue(false);
        const keys = deriveSilentPaymentKeys(mockSeed);
        const addr = await encodeSilentPaymentAddress(keys.scanPub, keys.spendPub);
        expect(addr).toContain('sp1');
        expect(addr).not.toBe('sp1_native_test');
    });

    it('uses native bridge for scanning when on native platform', async () => {
        (Capacitor.isNativePlatform as any).mockReturnValue(true);
        const keys = deriveSilentPaymentKeys(mockSeed);
        const results = await scanForSilentPayments(keys.scanKey, keys.spendPub, 100, 200);
        expect(results).toHaveLength(1);
        expect(results[0].txid).toBe('test');
    });
});
