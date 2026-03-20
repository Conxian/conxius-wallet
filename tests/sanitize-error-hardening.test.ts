import { describe, it, expect } from 'vitest';
import { sanitizeError } from '../services/network';

describe('sanitizeError Hardening', () => {
  it('should detect obfuscated secrets in Error message', () => {
    // A Bitcoin address obfuscated with Zero-Width Characters (U+200B)
    const obfuscatedAddr = 'bc1q\u200Bxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    const error = new Error(`Failed to send to ${obfuscatedAddr}`);

    // Standard sanitizeError should detect it even if obfuscated
    const result = sanitizeError(error, 'Fallback');
    expect(result).toBe('Fallback');
  });

  it('should detect secrets in nested error objects that JSON.stringify might miss', () => {
    const secret = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    const error = {
        message: 'Outer error',
        nested: new Error(secret)
    };

    // JSON.stringify on the outer object might fail to stringify the nested Error message
    // depending on the environment and how it's called.
    // Our implementation uses a replacer that should handle objects.

    const result = sanitizeError(error, 'Fallback');
    expect(result).toBe('Fallback');
  });
});
