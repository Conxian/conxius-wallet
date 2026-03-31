import { describe, it, expect } from 'vitest';
import { sanitizeError, endpointsFor } from '../services/network';

describe('sanitizeError Hardening & Regression', () => {
  it('should not be stateful across multiple calls with different lengths (REPRODUCTION FIX)', () => {
    const secret = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    const fallback = 'Fallback';

    // Length of secret is 42
    // secret matches bc1q... (BTC_ADDR_REGEX)

    // Call with long string that includes secret at the end
    const longStr = "A".repeat(100) + secret;
    expect(sanitizeError(longStr, fallback)).toBe(fallback);

    // Now call with short string which IS the secret
    // This should ALSO be redacted.
    const result2 = sanitizeError(secret, fallback);
    expect(result2).toBe(fallback);
  });

  it('should verify testnet NUBIT_API endpoint (REGRESSION)', () => {
    const endpoints = endpointsFor('testnet');
    expect(endpoints.NUBIT_API).toBe('https://rpc.testnet.nubit.org');
  });

  it('should verify mainnet NUBIT_API endpoint (REGRESSION)', () => {
    const endpoints = endpointsFor('mainnet');
    expect(endpoints.NUBIT_API).toBe('https://rpc.nubit.org');
  });

  it('should verify devnet/regtest endpoints (REGRESSION)', () => {
    const devnet = endpointsFor('devnet');
    const regtest = endpointsFor('regtest');
    expect(devnet.BTC_API).toBe('http://127.0.0.1:8080');
    expect(regtest.BTC_API).toBe('http://127.0.0.1:8080');
    expect(devnet.NUBIT_API).toBe('http://127.0.0.1:8553');
  });

  it('should detect obfuscated secrets in Error message', () => {
    // A Bitcoin address obfuscated with Zero-Width Characters (U+200B)
    const obfuscatedAddr = 'bc1q\u200Bxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    const error = new Error(`Failed to send to ${obfuscatedAddr}`);

    // Standard sanitizeError should detect it even if obfuscated
    const result = sanitizeError(error, 'Fallback');
    expect(result).toBe('Fallback');
  });

  it('should detect secrets in nested error objects', () => {
    const secret = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    const error = {
        message: 'Outer error',
        nested: new Error(secret)
    };

    const result = sanitizeError(error, 'Fallback');
    expect(result).toBe('Fallback');
  });

  it('should redact AI Service API Keys in error objects', () => {
    // Use obvious placeholder strings that still match the project's redaction regexes
    // but are unlikely to trigger CI secret scanners like GitGuardian.
    const openaiKey = 'sk-' + 'X'.repeat(40);
    expect(sanitizeError(`Leaked: ${openaiKey}`)).toBe('Protocol Error');

    const githubKey = 'github_pat_' + 'A'.repeat(80);
    expect(sanitizeError(`Leaked: ${githubKey}`)).toBe('Protocol Error');

    const awsKey = 'AKIA' + '123456789012';
    expect(sanitizeError(`Leaked: ${awsKey}`)).toBe('Protocol Error');
  });
});
