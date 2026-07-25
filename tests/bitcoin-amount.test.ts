import { describe, expect, it } from 'vitest';
import {
    formatSatoshisAsBtc,
    parseBtcToSatoshis,
    parseSatoshiAmount,
    toSafeSatoshiNumber,
} from '../services/bitcoin-amount';

describe('strict Bitcoin amount parsing', () => {
    it.each([
        ['0.00000001', 1n],
        ['1', 100_000_000n],
        ['1.00000001', 100_000_001n],
        ['21000000', 2_100_000_000_000_000n],
    ])('parses %s exactly', (input, expected) => {
        expect(parseBtcToSatoshis(input)).toBe(expected);
        expect(toSafeSatoshiNumber(expected)).toBe(Number(expected));
    });

    it.each([
        '', '0', '0.00000000', '-1', '+1', ' 1', '1 ', '1e-8', '.1', '01', '1.', '0.000000001',
        '90071992.54740992',
    ])('rejects ambiguous, non-positive, over-precision, or unsafe BTC input %j', (input) => {
        expect(() => parseBtcToSatoshis(input)).toThrow();
    });

    it('parses canonical satoshi strings and rejects decimal or unsafe values', () => {
        expect(parseSatoshiAmount('1250')).toBe(1250n);
        for (const input of ['', '0', '-1', '+1', ' 1', '01', '1.0', '1e3', '9007199254740992']) {
            expect(() => parseSatoshiAmount(input)).toThrow();
        }
    });

    it('formats satoshis without floating point', () => {
        expect(formatSatoshisAsBtc(1n)).toBe('0.00000001');
        expect(formatSatoshisAsBtc(100_010_000n)).toBe('1.0001');
    });
});
