import * as bip39 from 'bip39';
import { BIP32Factory, BIP32Interface } from 'bip32';
import * as ecc from 'tiny-secp256k1';

const bip32 = BIP32Factory(ecc);

// Session-level caches to eliminate redundant heavy computations
const pbkdf2Cache = new Map<string, Uint8Array>();
const nodeCache = new Map<string, BIP32Interface>();

/**
 * Crypto Worker
 * Handles PBKDF2 and BIP32 derivations in a separate thread.
 */
self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    switch (type) {
      case 'DERIVE_SEED': {
        const { mnemonic, passphrase } = payload;
        const cacheKey = `seed:${mnemonic}:${passphrase}`;

        if (pbkdf2Cache.has(cacheKey)) {
          self.postMessage({ id, result: pbkdf2Cache.get(cacheKey) });
          return;
        }

        const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
        const seedArray = new Uint8Array(seed);
        pbkdf2Cache.set(cacheKey, seedArray);
        self.postMessage({ id, result: seedArray });
        break;
      }

      case 'DERIVE_PATH': {
        const { seed, path } = payload;
        const seedHex = Buffer.from(seed).toString('hex');
        const cacheKey = `path:${seedHex}:${path}`;

        if (nodeCache.has(cacheKey)) {
          const node = nodeCache.get(cacheKey)!;
          self.postMessage({
            id,
            result: {
              publicKey: node.publicKey.toString('hex'),
              privateKey: node.privateKey?.toString('hex')
            }
          });
          return;
        }

        const root = bip32.fromSeed(Buffer.from(seed));
        const child = root.derivePath(path);
        nodeCache.set(cacheKey, child);

        self.postMessage({
          id,
          result: {
            publicKey: child.publicKey.toString('hex'),
            privateKey: child.privateKey?.toString('hex')
          }
        });
        break;
      }

      case 'CLEAR_CACHE': {
        pbkdf2Cache.forEach(buf => buf.fill(0));
        pbkdf2Cache.clear();
        nodeCache.clear();
        self.postMessage({ id, result: true });
        break;
      }

      default:
        throw new Error(`Unknown worker task type: ${type}`);
    }
  } catch (error: any) {
    self.postMessage({ id, error: error.message });
  }
};
