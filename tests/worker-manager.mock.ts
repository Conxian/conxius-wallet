import { vi } from 'vitest';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';

const bip32 = BIP32Factory(ecc);

export const mockWorkerManager = {
  deriveSeed: vi.fn(async (mnemonic: string, passphrase = '') => {
    const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
    return new Uint8Array(seed);
  }),
  derivePath: vi.fn(async (seed: Uint8Array, path: string) => {
    const root = bip32.fromSeed(Buffer.from(seed));
    const child = root.derivePath(path);
    return {
      publicKey: child.publicKey.toString('hex'),
      privateKey: child.privateKey?.toString('hex')
    };
  }),
  clearCache: vi.fn(async () => {})
};
