import { describe, it, expect } from 'vitest';
import { encryptSeed, decryptSeed } from '../services/seed';

describe('seed vault', () => {
  it('roundtrips seed bytes', async () => {
    const seed = globalThis.crypto.getRandomValues(new Uint8Array(64));
    const seedCopy = new Uint8Array(seed);
    const pin = '1234';
    const enc = await encryptSeed(seed, pin);
    const dec = await decryptSeed(enc, pin);
    expect(Array.from(dec)).toEqual(Array.from(seedCopy));
    // Verify that the original seed buffer was zeroed out (Zero-Leak hardening)
    expect(Array.from(seed)).toEqual(new Array(64).fill(0));
  });

  it('rejects wrong pin', async () => {
    const seed = new Uint8Array([1, 2, 3, 4]);
    const enc = await encryptSeed(seed, '1234');
    await expect(decryptSeed(enc, '9999')).rejects.toThrow();
  });
});

