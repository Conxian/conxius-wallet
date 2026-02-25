import { describe, it, expect } from 'vitest';
import { sanitizeError } from '../services/network';

describe('Security: Error Sanitization', () => {
  it('should allow safe error messages', () => {
    expect(sanitizeError('Network request failed')).toBe('Network request failed');
    expect(sanitizeError(new Error('Invalid address'))).toBe('Invalid address');
  });

  it('should block stack traces in strings', () => {
    const leakedTrace = 'Error: something broke\n    at Object.<anonymous> (/app/test.js:1:1)';
    expect(sanitizeError(leakedTrace)).toBe('Protocol Error');
  });

  it('should block internal details like database or query', () => {
    expect(sanitizeError('SQL injection in query')).toBe('Protocol Error');
    expect(sanitizeError('Failed to connect to database')).toBe('Protocol Error');
  });

  it('should block RPC details', () => {
    expect(sanitizeError('RPC internal error: -32603')).toBe('Protocol Error');
  });

  it('should block hex addresses that look like Ethereum addresses', () => {
    expect(sanitizeError('Insufficient funds for 0x71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe('Protocol Error');
  });

  it('should block __ double underscores (often internal properties)', () => {
    expect(sanitizeError('Error in __webpack_require__')).toBe('Protocol Error');
  });

  it('should truncate very long error messages', () => {
    const longMsg = 'A'.repeat(200);
    const sanitized = sanitizeError(longMsg);
    expect(sanitized.length).toBeLessThanOrEqual(100);
    expect(sanitized).toBe('A'.repeat(100));
  });

  it('should return default message for null or empty input', () => {
    expect(sanitizeError(null)).toBe('Protocol Error');
    expect(sanitizeError(undefined)).toBe('Protocol Error');
    expect(sanitizeError('')).toBe('Protocol Error');
  });

  it('should block BIP-39 mnemonic phrases (12 words)', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    expect(sanitizeError(`Failed to process: ${mnemonic}`)).toBe('Protocol Error');
  });

  it('should block 64-character hex private keys', () => {
    const privKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    expect(sanitizeError(`Secret key leaked: ${privKey}`)).toBe('Protocol Error');
  });

  it('should block BIP32 extended private keys (xprv)', () => {
    const xprv = 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKm2sEWWTip7z8Y9H9mK9v8f4m9qGjGjGjGjGjGjGjGjGj';
    expect(sanitizeError(`Leaked root key: ${xprv}`)).toBe('Protocol Error');
  });
});
