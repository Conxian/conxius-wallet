import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';
import { Capacitor } from "@capacitor/core";
import { signNonValueMessageNative } from "./enclave-storage";
import { signSchnorr } from "./ecc";
import { workerManager } from "./worker-manager";
import { getAddressFromPublicKey } from "@stacks/transactions";
import { deriveLiquidAddress } from "./liquid";
import { keccak_256 } from "@noble/hashes/sha3.js";

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

export interface SignResult {
  signature: string;
  pubkey: string;
  timestamp: number;
}

/** Explicitly non-value message signing request for login and proof flows. */
export interface NonValueMessageSignRequest {
  readonly intentClass: 'non-value-message';
  readonly type: 'message' | 'bip322';
  readonly layer: 'Mainnet' | 'Nostr';
  readonly domain: 'conxius.wallet.message' | 'conxius.wallet.bip322' | 'conxius.nostr.evaluation';
  readonly purpose: 'wallet-message' | 'wallet-bip322' | 'nostr-evaluation';
  readonly payload: unknown;
  readonly description: string;
}

export class LegacyValueSigningBlockedError extends Error {
  readonly code = 'legacy_value_signing_blocked';

  constructor(message = 'Value signing is blocked at the legacy signer. Use the centralized value-operation gate.') {
    super(message);
    this.name = 'LegacyValueSigningBlockedError';
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function containsValueOperationShape(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => containsValueOperationShape(entry, seen));
  if (!isPlainRecord(value)) return true;
  const keys = Object.keys(value);
  const normalizedKeys = keys.map((key) => key.toLowerCase().replace(/[_-]/g, ''));
  if (normalizedKeys.some((key) => [
    'psbt', 'rawtx', 'rawtransaction', 'transaction', 'tx', 'valueartifact', 'valueenvelope',
    'operationtype', 'canonicaloperationdigest', 'broadcastreadyhex', 'broadcast', 'settlement', 'settle',
    'recipient', 'destination', 'amount',
  ].includes(key))) {
    return true;
  }
  return Object.values(value).some((entry) => containsValueOperationShape(entry, seen));
}

function assertNonValueMessageRequest(request: unknown): asserts request is NonValueMessageSignRequest {
  if (!isPlainRecord(request)) throw new LegacyValueSigningBlockedError('Malformed non-value signing request.');
  const keys = Object.keys(request).sort();
  const expected = ['description', 'domain', 'intentClass', 'layer', 'payload', 'purpose', 'type'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new LegacyValueSigningBlockedError('Malformed non-value signing request.');
  }
  if (
    request.intentClass !== 'non-value-message'
    || (request.type !== 'message' && request.type !== 'bip322')
    || (request.layer !== 'Mainnet' && request.layer !== 'Nostr')
    || typeof request.description !== 'string' || request.description.length === 0
    || containsValueOperationShape(request.payload)
  ) {
    throw new LegacyValueSigningBlockedError('Non-value signing accepts message-compatible payloads only.');
  }
  const payload = request.payload;
  if (typeof payload !== 'string') {
    if (!isPlainRecord(payload)) throw new LegacyValueSigningBlockedError('Non-value signing accepts message-compatible payloads only.');
    const payloadKeys = Object.keys(payload);
    if (payloadKeys.length !== 1 || !['hash', 'message'].includes(payloadKeys[0]) || typeof payload[payloadKeys[0]] !== 'string') {
      throw new LegacyValueSigningBlockedError('Non-value signing accepts a string, message, or 32-byte hash payload only.');
    }
    if (payloadKeys[0] === 'hash' && !/^[0-9a-f]{64}$/i.test(payload.hash as string)) {
      throw new LegacyValueSigningBlockedError('Non-value hash payload must be exactly 32 bytes.');
    }
  }
  const expectedDomain = request.purpose === 'wallet-message' ? 'conxius.wallet.message'
    : request.purpose === 'wallet-bip322' ? 'conxius.wallet.bip322'
      : request.purpose === 'nostr-evaluation' ? 'conxius.nostr.evaluation' : undefined;
  if (!expectedDomain || request.domain !== expectedDomain
    || (request.type === 'bip322') !== (request.purpose === 'wallet-bip322')
    || (request.layer === 'Nostr') !== (request.purpose === 'nostr-evaluation')) {
    throw new LegacyValueSigningBlockedError('Non-value signing domain, purpose, type, and layer must match.');
  }
}

/**
 * High-level signing interface. Routes to Native Enclave (StrongBox)
 * or secure TypeScript worker based on environment.
 */
const requestEnclaveSignature = async (
  request: NonValueMessageSignRequest,
  seedOrVault: string | Uint8Array
): Promise<SignResult> => {
  console.info(`[Signer] Requesting signature for layer: ${request.layer}`);

  if (Capacitor.isNativePlatform()) {
    const vault = typeof seedOrVault === 'string' ? seedOrVault : 'default_vault';

    try {
        const payload = request.payload as string | { hash: string } | { message: string };
        const messageHash = typeof payload === 'string'
          ? Buffer.from(bitcoin.crypto.sha256(Buffer.from(payload))).toString('hex')
          : 'hash' in payload
            ? payload.hash
            : Buffer.from(bitcoin.crypto.sha256(Buffer.from(payload.message))).toString('hex');
        const res = await signNonValueMessageNative({
            intentClass: 'non-value-message',
            purpose: request.purpose,
            domain: request.domain,
            vault,
            messageHash,
            network: 'mainnet',
        });

        return {
            signature: res.signature,
            pubkey: res.pubkey,
            timestamp: Date.now()
        };

    } catch (e: unknown) {
        console.error("[Signer] Native signing failed; refusing software fallback");
        throw e;
    }
  }

  // --- FALLBACK / WEB PATH (TypeScript Worker) ---
  let seedBytes: Uint8Array;
  if (typeof seedOrVault === "string") {
      if (seedOrVault.length >= 32 && !seedOrVault.includes(" ")) {
          // Hex seed
          seedBytes = new Uint8Array(Buffer.from(seedOrVault, 'hex'));
      } else {
          // Mnemonic
          const seed = await bip39.mnemonicToSeed(seedOrVault);
          seedBytes = new Uint8Array(seed);
      }
  } else if (seedOrVault instanceof Uint8Array) {
      seedBytes = seedOrVault;
  } else {
      if (request.layer !== 'Nostr') throw new Error("Seed required for fallback signer");
      seedBytes = new Uint8Array(64); // Placeholder
  }

  if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
      await new Promise(r => setTimeout(r, 100)); // Simulate enclave delay
  }

  try {
      let signature = "";
      let pubkey = "";
      const path = request.layer === 'Nostr' ? "m/44'/1237'/0'/0/0" : "m/84'/0'/0'/0/0";

      if (request.layer === "Nostr") {
          const nPath = "m/44'/1237'/0'/0/0";
          const derived = await workerManager.derivePath(seedBytes, nPath, "mainnet");
          return { signature: "", pubkey: Buffer.from(derived.publicKey).toString("hex"), timestamp: Date.now() };
      }

      const derived = await workerManager.derivePath(seedBytes, path, "mainnet");
      pubkey = Buffer.from(derived.publicKey).toString("hex");

      if (derived.privateKey) {
          const privKeyBuf = Buffer.from(derived.privateKey, 'hex');
          try {
            const child = bip32.fromSeed(Buffer.concat([privKeyBuf, Buffer.alloc(32, 0)]));
            let messageHash: Buffer;
            const payload = request.payload as string | { hash: string } | { message: string };
            if (typeof payload !== 'string' && 'hash' in payload) {
                messageHash = Buffer.from(payload.hash, 'hex');
            } else if (typeof payload === 'string') {
                messageHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from(payload)));
            } else {
                messageHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from(JSON.stringify(request.payload))));
            }

            if (path.includes("86'")) {
                signature = Buffer.from(signSchnorr(messageHash, privKeyBuf)).toString('hex');
            } else {
                signature = Buffer.from(child.sign(messageHash)).toString('hex');
            }
          } finally {
            privKeyBuf.fill(0);
          }
      }

      return {
        signature,
        pubkey,
        timestamp: Date.now(),
      };
  } finally {
    if (seedBytes instanceof Uint8Array) seedBytes.fill(0);
  }
};

/**
* Non-value compatibility boundary. Value-operation callers must use
* signAuthorizedValueOperationNative from value-signer.ts instead.
*/
export const requestNonValueMessageSignature = async (
  request: NonValueMessageSignRequest,
  seedOrVault: string | Uint8Array,
): Promise<SignResult> => {
  assertNonValueMessageRequest(request);
  return requestEnclaveSignature(request, seedOrVault);
};

/**
 * Signs a BIP-322 message (Used by tests and login flows)
 */
export const signBip322Message = async (message: string, seed: Uint8Array): Promise<string> => {
    const result = await requestNonValueMessageSignature({
        intentClass: 'non-value-message',
        type: 'bip322',
        layer: 'Mainnet',
        domain: 'conxius.wallet.bip322',
        purpose: 'wallet-bip322',
        payload: { hash: Buffer.from(bitcoin.crypto.sha256(Buffer.from(message))).toString('hex') },
        description: 'Sign BIP-322 message'
    }, seed);
    return result.signature;
};

/**
 * Derives a set of sovereign addresses/pubkeys for major layers.
 * (Used for onboarding and dashboard alignment)
 */
export const deriveSovereignRoots = async (mnemonic: string, passphrase?: string) => {
    if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("Invalid Mnemonic Phrase");
    }

    const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
    const root = bip32.fromSeed(seed);

    // BIP-84 Bitcoin Native Segwit
    const btcChild = root.derivePath("m/84'/0'/0'/0/0");
    const btc = bitcoin.payments.p2wpkh({ pubkey: btcChild.publicKey }).address!;

    // BIP-86 Bitcoin Taproot
    const trChild = root.derivePath("m/86'/0'/0'/0/0");
    const taproot = bitcoin.payments.p2tr({ pubkey: trChild.publicKey.slice(1, 33) }).address!;

    // BIP-44 EVM Path (BOB, B2, RSK, etc)
    const ethChild = root.derivePath("m/44'/60'/0'/0/0");
    const eth = publicKeyToEvmAddress(Buffer.from(ethChild.publicKey));
    const rbtc = eth;

    // BIP-44 Stacks Path
    const stxChild = root.derivePath("m/44'/5757'/0'/0/0");
    const stx = getAddressFromPublicKey(stxChild.publicKey);

    // Liquid
    const liquid = deriveLiquidAddress(Buffer.from(stxChild.publicKey));

    return { btc, taproot, eth, rbtc, stx, liquid, derivationPath: "m/84'/0'/0'/0/0" };
};

/**
 * Helper to convert pubkey to EVM address (Standard Keccak-256)
 */
function publicKeyToEvmAddress(pubkey: Buffer): string {
    // Standard Ethereum address derivation: keccak256(pubkey.slice(1)).slice(-20)
    // Strip the 0x04 prefix from the uncompressed public key
    const uncompressed = pubkey.length === 65 ? pubkey.slice(1) : pubkey;
    const hash = keccak_256(uncompressed);
    return '0x' + Buffer.from(hash.slice(-20)).toString('hex');
}

/**
 * Parses a BIP-322 message to identify and extract structured login details.
 * Security: Uses an anchored regex (^) to prevent spoofing via prepended content.
 */
export function parseBip322Message(message: string): {
    isLogin: boolean;
    domain?: string;
    nonce?: string;
    timestamp?: string;
} {
    // Expected Format from IdentityService:
    // <Domain> wants you to sign in with your Conxius Identity:
    // <Address>
    // URI: <DID>
    // Web5: <Web5DID>
    // Nonce: <Challenge>
    // Issued At: <ISO Timestamp>

    const loginRegex = /^(.+?) wants you to sign in with your Conxius Identity:/;
    const match = message.match(loginRegex);

    if (!match) {
        return { isLogin: false };
    }

    const domain = match[1];
    const nonceMatch = message.match(/Nonce: (.+)/);
    const timestampMatch = message.match(/Issued At: (.+)/);

    return {
        isLogin: true,
        domain,
        nonce: nonceMatch ? nonceMatch[1].trim() : undefined,
        timestamp: timestampMatch ? timestampMatch[1].trim() : undefined
    };
}

export { signAuthorizedValueOperationNative } from './value-signer';
export type { NativeValueSigningOutcome, NativeValueSigningRequest } from './value-signer';
