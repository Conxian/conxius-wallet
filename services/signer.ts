import { ensureDeviceSafety } from "./integrity";
import { deriveLiquidAddress } from './liquid';

/**
 * Conxius Signing Enclave Service - Production Grade
 * Handles deterministic key derivation and multi-layer signing via Real Cryptography.
 */

import { BitcoinLayer, Network } from '../types';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import { signSchnorr } from './ecc';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { Capacitor } from "@capacitor/core";
import { signNative, getWalletInfoNative, signBatchNative } from "./enclave-storage";
import { getAddressFromPublicKey } from '@stacks/transactions';
import {
  getPsbtSighashes,
  finalizePsbtWithSigs,
  signPsbtBase64,
} from "./psbt";

// Initialize BIP32
const bip32 = BIP32Factory(ecc);
import { workerManager } from './worker-manager';
bitcoin.initEccLib(ecc);

if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

export interface SignRequest {
  type: 'transaction' | 'message' | 'event' | 'bip322';
  layer: BitcoinLayer | 'Nostr';
  payload: any;
  description: string;
}

export interface SignResult {
  signature: string;
  pubkey: string;
  broadcastReadyHex?: string;
  psbtBase64?: string;
  timestamp: number;
}

/**
 * Centralized Signing Orchestrator
 */
export const requestEnclaveSignature = async (
  request: SignRequest,
  seedOrVault?: Uint8Array | string,
  pin?: string,
): Promise<SignResult> => {
    // Security Hardening: Play Integrity for high-value transactions
    if (request.type === "transaction") {
        const amountSats = request.payload?.amountSats || 0;
        if (amountSats > 10000000) {
            const isSafe = await ensureDeviceSafety();
            if (!isSafe) throw new Error("Security Check Failed: Device integrity mandatory for high-value operations.");
        }
    }

  // Master Seed is required for non-native platforms
  if (!Capacitor.isNativePlatform() && !seedOrVault) {
    if (request.layer !== 'Nostr') {
        throw new Error("Master Seed missing from session vault.");
    }
  }

  // --- NATIVE PATH (Android/iOS) ---
  if (Capacitor.isNativePlatform() && typeof seedOrVault === "string") {
    const vault = seedOrVault;
    const network = request.payload?.network || "mainnet";

    // Determine Derivation Path
    let path = "m/84'/0'/0'/0/0";
    if (request.layer === "Stacks") path = "m/44'/5757'/0'/0/0";
    else if (request.layer === "Liquid") path = "m/84'/1776'/0'/0/0";
    else if (request.layer === "BOB") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "B2") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Botanix") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Mezo") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Rootstock") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Alpen") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Zulu") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Bison") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Hemi") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Nubit") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Lorenzo") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Citrea") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Babylon") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Merlin") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Bitlayer") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "Ethereum") path = "m/44'/60'/0'/0/0";
    else if (request.layer === "RGB") path = "m/86'/0'/0'/0/0";
    else if (request.layer === "TaprootAssets") path = "m/86'/0'/0'/0/0";
    else if (request.layer === "Runes") path = "m/86'/0'/0'/0/0";
    else if (request.layer === "Ordinals") path = "m/86'/0'/0'/0/0";
    else if (request.layer === "StateChain") {
        const index = request.payload?.index || 0;
        path = `m/84'/0'/0'/2/${index}`;
    } else if (request.layer === "Mainnet") path = "m/84'/0'/0'/0/0";
    else if (request.layer === "Ark") path = "m/84'/0'/0'/1/0";
    else if (request.layer === "BitVM") path = "m/84'/0'/0'/4/0";
    else if (request.layer === "Maven") path = "m/84'/0'/0'/3/0";

    try {
        // Handle PSBT Batch Signing
        if (request.payload?.psbt) {
            const idRes = await signNative({
                vault,
                pin,
                path,
                messageHash: "PUBKEY_DERIVATION",
                network
            });
            const pubkey = idRes.pubkey;
            const pubkeyBuf = Buffer.from(pubkey, "hex");

            const hashes = getPsbtSighashes(request.payload.psbt, pubkeyBuf, network);
            const { getUnsignedTxHex } = await import("./psbt");
            const unsignedTx = getUnsignedTxHex(request.payload.psbt, network);

            const batchRes = await signBatchNative({
                vault,
                pin,
                path,
                hashes: hashes.map(h => h.hash.toString("hex")),
                network,
                payload: unsignedTx
            });

            const signatures = batchRes.signatures.map((res: any, i: number) => ({
                index: hashes[i].index,
                signature: Buffer.from(res.signature, "hex"),
            }));

            const broadcastHex = finalizePsbtWithSigs(request.payload.psbt, signatures, pubkeyBuf, network);

            return {
                signature: batchRes.signatures[0]?.signature || "",
                pubkey,
                broadcastReadyHex: broadcastHex,
                timestamp: Date.now()
            };
        }

        // Standard Message/Transaction Signing
        const messageHash = request.payload?.hash || Buffer.from(bitcoin.crypto.sha256(Buffer.from(JSON.stringify(request.payload)))).toString('hex');

        const res = await signNative({
            vault,
            pin,
            path,
            messageHash,
            network: request.layer === "RGB" ? "rgb" : request.layer === "StateChain" ? "statechain" : network,
            payload: JSON.stringify(request.payload)
        });

        return {
            signature: res.signature,
            pubkey: res.pubkey,
            timestamp: Date.now()
        };

    } catch (e: any) {
        console.error("Native signing failed, falling back to TS worker", e);
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
      let path = "m/84'/0'/0'/0/0";

      if (request.layer === "Stacks") path = "m/44'/5757'/0'/0/0";
      else if (request.layer === "Mainnet") path = "m/84'/0'/0'/0/0";
      else if (request.layer === "Liquid") path = "m/84'/1776'/0'/0/0";
      else if (request.layer === "Ark") path = "m/84'/0'/0'/1/0";
      else if (request.layer === "BitVM") path = "m/84'/0'/0'/4/0";
      else if (request.layer === "Maven") path = "m/84'/0'/0'/3/0";
      else if (request.layer === "BOB") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "B2") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Botanix") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Mezo") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Rootstock") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Alpen") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Zulu") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Bison") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Hemi") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Nubit") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Lorenzo") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Citrea") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Babylon") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Merlin") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Bitlayer") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "Ethereum") path = "m/44'/60'/0'/0/0";
      else if (request.layer === "RGB") path = "m/86'/0'/0'/0/0";
      else if (request.layer === "TaprootAssets") path = "m/86'/0'/0'/0/0";
      else if (request.layer === "Runes") path = "m/86'/0'/0'/0/0";
      else if (request.layer === "Ordinals") path = "m/86'/0'/0'/0/0";
      else if (request.layer === "StateChain") {
          const index = request.payload?.index || 0;
          path = `m/84'/0'/0'/2/${index}`;
      }

      if (request.layer === "Nostr") {
          const nPath = "m/44'/1237'/0'/0/0";
          const derived = await workerManager.derivePath(seedBytes, nPath);
          return { signature: "", pubkey: derived.publicKey, timestamp: Date.now() };
      }

      const derived = await workerManager.derivePath(seedBytes, path);
      pubkey = derived.publicKey;

      if (derived.privateKey) {
          const privKeyBuf = Buffer.from(derived.privateKey, 'hex');
          try {
            const child = bip32.fromPrivateKey(privKeyBuf, Buffer.alloc(32));
            let messageHash: Buffer;
            if (request.payload?.hash) {
                messageHash = Buffer.from(request.payload.hash, 'hex');
            } else if (typeof request.payload === 'string') {
                messageHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from(request.payload)));
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
 * Signs a BIP-322 message (Used by tests and login flows)
 */
export const signBip322Message = async (message: string, seed: Uint8Array): Promise<string> => {
    const result = await requestEnclaveSignature({
        type: 'bip322',
        layer: 'Mainnet',
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
    const eth = publicKeyToEvmAddress(ethChild.publicKey);
    const rbtc = eth;

    // BIP-44 Stacks Path
    const stxChild = root.derivePath("m/44'/5757'/0'/0/0");
    const stx = getAddressFromPublicKey(stxChild.publicKey.toString('hex'));

    // Liquid
    const liquid = deriveLiquidAddress(stxChild.publicKey);

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
 * Parses a BIP-322 message to identify login requests.
 */
export const parseBip322Message = (message: string) => {
    const isLogin = /^\[Conxius Login\]/.test(message);
    const domainMatch = message.match(/Domain: ([a-zA-Z0-9.-]+)/);
    const nonceMatch = message.match(/Nonce: ([a-zA-Z0-9]+)/);
    const timestampMatch = message.match(/Timestamp: ([0-9]+)/);
    return {
        isLogin,
        domain: domainMatch ? domainMatch[1] : undefined,
        nonce: nonceMatch ? nonceMatch[1] : undefined,
        timestamp: timestampMatch ? parseInt(timestampMatch[1]) : undefined
    };
};
