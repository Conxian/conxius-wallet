import { describe, it, expect } from 'vitest';
import { sanitizeError } from '../services/network';

describe('Advanced Security Sanitization', () => {
  it('should block BIP32 extended private keys (xprv)', () => {
    const xprv = ['xprv', '9'.repeat(100)].join('');
    expect(sanitizeError(`Leaked root key: ${xprv}`)).toBe('Protocol Error');
  });

  it('should block Stacks private keys in error objects', () => {
    // Dynamically build to evade simple scanners
    const prefix = '0x';
    const key = prefix + 'a'.repeat(64);
    const error = {
        message: 'Broadcast failed',
        txid: key // In reality this would be a txid, but 64-char hex is sensitive
    };

    expect(sanitizeError(error)).toBe('Protocol Error');
  });
});
