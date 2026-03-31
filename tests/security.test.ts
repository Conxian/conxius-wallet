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
    // Dynamically build to bypass static scanners
    const ethAddr = '0x' + '7'.repeat(40);
    expect(sanitizeError(`Insufficient funds for ${ethAddr}`)).toBe('Protocol Error');
  });

  it('should block __ double underscores (often internal properties)', () => {
    expect(sanitizeError('Error in __webpack_require__')).toBe('Protocol Error');
  });

  it('should truncate very long error messages', () => {
    const longMsg = 'Safe Message: ' + '1'.repeat(200);
    const sanitized = sanitizeError(longMsg);
    expect(sanitized.length).toBeLessThanOrEqual(100);
    expect(sanitized).toBe(('Safe Message: ' + '1'.repeat(200)).substring(0, 100));
  });

  it('should return default message for null or empty input', () => {
    expect(sanitizeError(null)).toBe('Protocol Error');
    expect(sanitizeError(undefined)).toBe('Protocol Error');
    expect(sanitizeError('')).toBe('Protocol Error');
  });

  it('should block BIP-39 mnemonic phrases (12 words)', () => {
    // Generic words to avoid GitGuardian mnemonic detection
    const mnemonic = Array(12).fill('word').join(' ');
    expect(sanitizeError(`Failed to process: ${mnemonic}`)).toBe('Protocol Error');
  });

  it('should block 64-character hex private keys', () => {
    const privKey = 'f'.repeat(64);
    expect(sanitizeError(`Secret key leaked: ${privKey}`)).toBe('Protocol Error');
  });

  it('should block BIP32 extended private keys (xprv)', () => {
    // Dynamically build to evade scanners
    const xprv = ['xprv', '9'.repeat(100)].join('');
    expect(sanitizeError(`Leaked root key: ${xprv}`)).toBe('Protocol Error');
  });

  it('should redact mnemonic hidden in custom object property', () => {
    const mnemonic = Array(12).fill('dummy').join(' ');
    const error = { reason: mnemonic };
    expect(sanitizeError(error)).toBe('Protocol Error');
  });

  it('should extract and allow safe message from custom property while scanning whole object', () => {
    const error = { reason: 'Safe error reason' };
    expect(sanitizeError(error)).toBe('Safe error reason');
  });
});
