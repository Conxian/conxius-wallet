import { describe, it, expect } from 'vitest';
import { generateRandomString } from '../services/random';

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
});
