import { describe, it, expect } from 'vitest';
import { generateRandomString, getRandomInt } from '../services/random';

describe('Random Utility', () => {
    it('should generate a string of requested length', () => {
        const len = 10;
        const result = generateRandomString(len);
        expect(result.length).toBe(len);
    });

    it('should generate different strings on subsequent calls', () => {
        const s1 = generateRandomString(12);
        const s2 = generateRandomString(12);
        expect(s1).not.toBe(s2);
    });

    it('should only contain valid characters (base36 subset)', () => {
        const result = generateRandomString(100);
        const validChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        for (const char of result) {
            expect(validChars).toContain(char);
        }
    });

    it('should handle zero length', () => {
        expect(generateRandomString(0)).toBe('');
    });

    describe('getRandomInt', () => {
        it('should return a number within range [0, max)', () => {
            const max = 10;
            for (let i = 0; i < 100; i++) {
                const result = getRandomInt(max);
                expect(result).toBeGreaterThanOrEqual(0);
                expect(result).toBeLessThan(max);
            }
        });

        it('should return 0 when max is 1', () => {
            expect(getRandomInt(1)).toBe(0);
        });

        it('should throw error when max is 0 or negative', () => {
            expect(() => getRandomInt(0)).toThrow('max must be positive');
            expect(() => getRandomInt(-5)).toThrow('max must be positive');
        });

        it('should generate diverse values over time', () => {
            const max = 1000000;
            const results = new Set();
            for (let i = 0; i < 100; i++) {
                results.add(getRandomInt(max));
            }
            // Statistical check: highly unlikely to get 100 identical large random numbers
            expect(results.size).toBeGreaterThan(90);
        });
    });
});
