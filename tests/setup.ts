import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
// import * as matchers from '@testing-library/jest-dom/matchers';

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'node:util';
try {
  new globalThis.TextEncoder();
} catch {
  // @ts-ignore
  globalThis.TextEncoder = NodeTextEncoder;
}
try {
  new globalThis.TextDecoder();
} catch {
  // @ts-ignore
  globalThis.TextDecoder = NodeTextDecoder;
}

// Polyfill for crypto.subtle
import { webcrypto } from 'crypto';
// @ts-ignore
if (!globalThis.crypto) {
    // @ts-ignore
    globalThis.crypto = webcrypto;
}

// Ensure URL is globally available
import { URL } from 'url';
// @ts-ignore

// Mock worker-manager
vi.mock('../services/worker-manager', () => {
  return {
    workerManager: {
      deriveSeed: async (mnemonic: string, passphrase = '') => {
        const bip39 = await import('bip39');
        const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
        return new Uint8Array(seed);
      },
      derivePath: async (seed: Uint8Array, path: string) => {
        const { BIP32Factory } = await import('bip32');
        const ecc = await import('tiny-secp256k1');
        const bip32 = BIP32Factory(ecc);
        const root = bip32.fromSeed(Buffer.from(seed));
        const child = root.derivePath(path);
        return {
          publicKey: child.publicKey.toString('hex'),
          privateKey: child.privateKey?.toString('hex')
        };
      },
      clearCache: async () => {}
    }
  };
});
