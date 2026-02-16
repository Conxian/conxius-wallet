import { deriveLiquidAddress } from './liquid';

/**
 * Conxius Signing Enclave Service - Production Grade
 * Handles deterministic key derivation and multi-layer signing via Real Cryptography.
 */

import { BitcoinLayer } from '../types';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { getAddressFromPrivateKey, getAddressFromPublicKey } from '@stacks/transactions';
import { Buffer } from 'buffer';
import { signSchnorr } from './ecc';
import { publicKeyToEvmAddress } from './evm';
import { Capacitor } from "@capacitor/core";
import { signNative, getWalletInfoNative, signBatchNative } from "./enclave-storage";
import {
  getPsbtSighashes,
  finalizePsbtWithSigs,
  signPsbtBase64WithSeed,
  signPsbtBase64WithSeedReturnBase64,
} from "./psbt";

// Initialize BIP32
const bip32 = BIP32Factory(ecc);
import { workerManager } from './worker-manager';
bitcoin.initEccLib(ecc);

// Polyfill Buffer for browser environment if needed (handled by Vite plugin, but good practice)
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
 * Deterministically derives public addresses for all supported layers
 * utilizing BIP-84 and standard derivation paths.
 * 
 * @param mnemonicOrVault Mnemonic phrase (setup) or Vault Name (production)
 * @param passphraseOrPin Passphrase (setup) or PIN (production)
 */
export const deriveSovereignRoots = async (mnemonicOrVault: string, passphraseOrPin?: string) => {
  // Check if this is a Vault (JSON-like or managed name) or Mnemonic (space separated)
  const isMnemonic = mnemonicOrVault.includes(" ");
  
  if (!isMnemonic && Capacitor.isNativePlatform()) {
      // NATIVE ENCLAVE MODE
      // We assume mnemonicOrVault is the vault name/json
      try {
          const info = await getWalletInfoNative({
              vault: mnemonicOrVault,
              pin: passphraseOrPin
          });
          
          // Derive addresses from pubkeys
          const btcPubkey = Buffer.from(info.btcPubkey, 'hex');
          const { address: btcAddress } = bitcoin.payments.p2wpkh({ 
            pubkey: btcPubkey,
            network: bitcoin.networks.bitcoin
          });
          
          // Liquid Address (P2WPKH on Liquid Network - placeholder logic)
          // In reality we would use the Liquid Network object from a library like liquidjs-lib
          // For now, we return the Liquid Pubkey or derived address if compatible
          const liquidPubkey = Buffer.from(info.liquidPubkey, 'hex');
          // const { address: liquidAddress } = bitcoin.payments.p2wpkh({ pubkey: liquidPubkey, network: liquidNetwork });
          const liquidAddress = deriveLiquidAddress(Buffer.from(info.liquidPubkey, "hex"), "mainnet"); // Returning pubkey as placeholder if lib missing

          // Stacks Address Derivation from Pubkey
          const stxAddress = getAddressFromPublicKey(info.stxPubkey, 'mainnet');
          
          return {
            btc: btcAddress || '',
            taproot: info.taprootAddress || '',
            stx: stxAddress,
            rbtc: info.evmAddress, // Native returned address
            eth: info.evmAddress, // Ethereum shared root with RSK
            liquid: liquidAddress,
            derivationPath: "m/84'/0'/0'/0/0"
          };
      } catch (e) {
          console.error("Native derivation failed", e);
          // Fallthrough to mnemonic attempt if it looks like mnemonic? No.
          throw e;
      }
  }

  // LEGACY / SETUP MODE (JS BIP39)
  if (!bip39.validateMnemonic(mnemonicOrVault)) {
    throw new Error('Invalid Mnemonic Phrase');
  }

  const seed = await workerManager.deriveSeed(mnemonicOrVault, passphraseOrPin);
  try {
  // 1. Bitcoin Mainnet (Native Segwit - BIP84)
  const btcDerived = await workerManager.derivePath(seed, "m/84'/0'/0'/0/0");
  const { address: btcAddress } = bitcoin.payments.p2wpkh({ 
    pubkey: Buffer.from(btcDerived.publicKey, 'hex'),
    network: bitcoin.networks.bitcoin
  });

  // 1b. Bitcoin Taproot (BIP-86)
  const trDerived = await workerManager.derivePath(seed, "m/86'/0'/0'/0/0");
  const { address: trAddress } = bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(trDerived.publicKey, 'hex').slice(1, 33),
    network: bitcoin.networks.bitcoin
  });

  // 2. Stacks L2 (SIP-005)
  const stxDerived = await workerManager.derivePath(seed, "m/44'/5757'/0'/0/0");
  const stxAddress = getAddressFromPublicKey(stxDerived.publicKey, 'mainnet');

  // 3. Rootstock (RSK) / EVM Compatible
  const rskDerived = await workerManager.derivePath(seed, "m/44'/60'/0'/0/0");
  const rskAddress = publicKeyToEvmAddress(Buffer.from(rskDerived.publicKey, 'hex'));

  // 4. Liquid (m/84'/1776'/0'/0/0)
  const liquidDerived = await workerManager.derivePath(seed, "m/84'/1776'/0'/0/0");

  return {
    btc: btcAddress || '',
    taproot: trAddress || '',
    stx: stxAddress,
    rbtc: rskAddress,
    eth: rskAddress,
    liquid: deriveLiquidAddress(Buffer.from(liquidDerived.publicKey, "hex"), "mainnet"),
    derivationPath: "m/84'/0'/0'/0/0"
  };
  } finally {
    if (seed instanceof Uint8Array) {
      seed.fill(0);
    }
  }
};

/**
 * BIP-322 Simple Message Signing (Full Witness Structure)
 * 
 * Uses the Enclave to sign the message digest.
 * 
 * @param message The message string to sign
 * @param vaultOrSeed Vault name (Native) or Seed bytes (JS)
 * @param pin Enclave PIN (Native)
 */
export const signBip322Message = async (
    message: string, 
    vaultOrSeed: string | Uint8Array,
    pin?: string,
    scriptType: 'P2WPKH' | 'P2TR' = 'P2WPKH'
): Promise<string> => {
    // 1. Get Pubkey from Enclave
    const path = scriptType === 'P2TR' ? "m/86'/0'/0'/0/0" : "m/84'/0'/0'/0/0";
    
    let pubkey: Buffer;
    if (Capacitor.isNativePlatform()) {
        const res = await signNative({
            vault: vaultOrSeed as string,
            pin,
            path,
            messageHash: "DUMMY_HASH_FOR_PUBKEY",
            network: 'mainnet',
          payload: undefined
        });
        pubkey = Buffer.from(res.pubkey, 'hex');
    } else {
        if (typeof vaultOrSeed === 'string') throw new Error("BIP-322 JS fallback requires seed bytes");
        const root = bip32.fromSeed(Buffer.from(vaultOrSeed));
        const child = root.derivePath(path);
        pubkey = Buffer.from(child.publicKey);
    }

    // Step 1: Build the message hash per BIP-322
    const tag = bitcoin.crypto.sha256(Buffer.from('BIP0322-signed-message'));
    const msgBuf = Buffer.from(message, 'utf8');
    const taggedHash = bitcoin.crypto.sha256(Buffer.concat([tag, tag, msgBuf]));

    // Step 2: Build virtual "to_spend" transaction
    const toSpendScriptSig = Buffer.concat([
      Buffer.from([0x00, 0x20]),  // OP_0 PUSH32
      taggedHash
    ]);

    let output: Buffer;
    if (scriptType === 'P2TR') {
        const p2tr = bitcoin.payments.p2tr({ internalPubkey: pubkey.subarray(1, 33), network: bitcoin.networks.bitcoin });
        if (!p2tr.output) throw new Error('BIP-322: Failed to create P2TR output');
        output = Buffer.from(p2tr.output);
    } else {
        const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network: bitcoin.networks.bitcoin });
        if (!p2wpkh.output) throw new Error('BIP-322: Failed to create P2WPKH output');
        output = Buffer.from(p2wpkh.output);
    }

    const toSpendTx = new bitcoin.Transaction();
    toSpendTx.version = 0;
    toSpendTx.locktime = 0;
    toSpendTx.addInput(Buffer.alloc(32, 0), 0xFFFFFFFF, 0, toSpendScriptSig);
    toSpendTx.addOutput(output, BigInt(0));

    // Step 3: Build "to_sign" transaction
    const toSignTx = new bitcoin.Transaction();
    toSignTx.version = 0;
    toSignTx.locktime = 0;
    toSignTx.addInput(toSpendTx.getHash(), 0, 0);
    toSignTx.addOutput(Buffer.from([0x6a]), BigInt(0)); // OP_RETURN

    // Step 4: Calculate Sighash
    let sighash: Buffer;
    if (scriptType === 'P2TR') {
        // Taproot sign-to-spend
        sighash = Buffer.from(toSignTx.hashForWitnessV1(
            0,
            [output],
            [BigInt(0)],
            bitcoin.Transaction.SIGHASH_DEFAULT
        ));
    } else {
        const scriptCode = Buffer.concat([
            Buffer.from([0x76, 0xa9, 0x14]),  // OP_DUP OP_HASH160 PUSH20
            bitcoin.crypto.hash160(pubkey),
            Buffer.from([0x88, 0xac])         // OP_EQUALVERIFY OP_CHECKSIG
        ]);
        sighash = Buffer.from(toSignTx.hashForWitnessV0(
            0,
            scriptCode,
            BigInt(0),
            bitcoin.Transaction.SIGHASH_ALL
        ));
    }

    // Step 5: Sign the Hash using Enclave
    let signatureHex: string;
    if (Capacitor.isNativePlatform()) {
        const res = await signNative({
            vault: vaultOrSeed as string,
            pin,
            path,
            messageHash: sighash.toString('hex'),
            network: 'mainnet',
          payload: undefined
        });
        signatureHex = res.signature;
    } else {
        const root = bip32.fromSeed(Buffer.from(vaultOrSeed as Uint8Array));
        const child = root.derivePath(path);
        // Note: For Taproot, we should technically use Schnorr sign.
        // bitcoinjs-lib's sign() for BIP32 is ECDSA.
        // If scriptType is P2TR, we need a Schnorr signer.
        if (scriptType === 'P2TR') {
            if (!child.privateKey) throw new Error('BIP-322: Missing private key for Taproot signing');
            signatureHex = Buffer.from(signSchnorr(sighash, child.privateKey)).toString('hex');
        } else {
            signatureHex = Buffer.from(child.sign(sighash)).toString('hex');
        }
    }

    // Step 6: Serialize witness stack
    let witnessStack: Buffer[];
    if (scriptType === 'P2TR') {
        // Schnorr signature (usually 64 bytes)
        witnessStack = [Buffer.from(signatureHex, 'hex')];
    } else {
        const signature = Buffer.from(signatureHex, 'hex');
        const derSig = Buffer.from(bitcoin.script.signature.encode(signature, bitcoin.Transaction.SIGHASH_ALL));
        witnessStack = [derSig, pubkey];
    }
    const witnessItems = witnessStack.length;
    const parts: Buffer[] = [Buffer.from([witnessItems])];
    for (const item of witnessStack) {
      if (item.length < 0xfd) {
        parts.push(Buffer.from([item.length]));
      } else {
        parts.push(Buffer.from([0xfd, item.length & 0xff, (item.length >> 8) & 0xff]));
      }
      parts.push(Buffer.from(item));
    }
    return Buffer.concat(parts).toString('base64');
};

/**
 * Enclave Handshake
 * Simulates the Hardware Element delay and signing process.
 */
export const requestEnclaveSignature = async (
  request: SignRequest,
  seedOrVault?: Uint8Array | string,
  pin?: string,
): Promise<SignResult> => {
  // Simulate secure element processing time
  if (
    typeof window !== "undefined" &&
    !(window as any).Capacitor?.isNativePlatform()
  ) {
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!seedOrVault && request.layer !== "Nostr") {
    throw new Error("Master Seed missing from session vault.");
  }

  // --- NATIVE PATH (Android/iOS) ---
  if (Capacitor.isNativePlatform() && typeof seedOrVault === "string" && pin) {
    const vault = seedOrVault;
    // We assume Mainnet/Bitcoin Layer for now in this snippet
    if (request.layer === "Mainnet") {
      const network = request.payload?.network || "mainnet";
      const coin = network === "mainnet" ? 0 : 1;
      const path = `m/84'/${coin}'/0'/0/0`;

      // 1. Get Pubkey (Dummy Sign to derive path public key)
      // Ideally we cache this or pass it in request, but to be sure we ask enclave
      // We sign specific dummy hash to get pubkey
      const idRes = await signNative({
        vault,
        pin, // Can be undefined now (checking session)
        path,
        messageHash: "DUMMY_HASH_FOR_PUBKEY_DERIVATION",
        network,
          payload: JSON.stringify(request.payload)
        });
      const pubkey = idRes.pubkey;

      let signature = "";
      let broadcastHex = "";

      if (request.payload?.psbt) {
        const pubkeyBuf = Buffer.from(pubkey, "hex");
        const hashes = getPsbtSighashes(
          request.payload.psbt,
          pubkeyBuf,
          network,
        );

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

        broadcastHex = finalizePsbtWithSigs(
          request.payload.psbt,
          signatures,
          pubkeyBuf,
          network,
        );
        // Also get PSBT Base64 for flows that need it (PayJoin)
        // We import it dynamically or assume it's available since we are in the same module bundle conceptually,
        // but cleaner to call the helper we just added.
        const { finalizePsbtWithSigsReturnBase64 } = await import("./psbt");
        const signedBase64 = finalizePsbtWithSigsReturnBase64(
          request.payload.psbt,
          signatures,
          pubkeyBuf,
          network,
        );

        signature = Buffer.from(
          bitcoin.crypto.sha256(Buffer.from(broadcastHex, "hex")),
        ).toString("hex");

        return {
          signature,
          pubkey,
          broadcastReadyHex: broadcastHex,
          psbtBase64: signedBase64,
          timestamp: Date.now(),
        };
      } else {
        // General Payload Signing
        const cx = Buffer.from(JSON.stringify(request.payload));
        const hash = Buffer.from(bitcoin.crypto.sha256(cx)).toString("hex");
        const res = await signNative({
          vault,
          pin,
          path,
          messageHash: hash,
          network,
          payload: JSON.stringify(request.payload)
        });
        signature = res.signature;
      }

      return {
        signature,
        pubkey,
        broadcastReadyHex: broadcastHex,
        timestamp: Date.now(),
      };
    } else if (request.layer === "Stacks") {
      const path = "m/44'/5757'/0'/0/0";
      // Stacks usually signs a sha256d hash or similar, payload should be prepared hash usually
      // For Stacks transactions, we usually sign the txhash (Recoverable or not? Stacks uses V,R,S or DER? Stacks is compact recoverable)
      // Wait, Stacks is compact recoverable (65 bytes). BitcoinJ sign gives DER.
      // We need generic signing in Java to support different outputs or basic SECP256k1.
      // Current Java 'Stacks' branch (fallback below) does `child.sign(Buffer.from("stacks-sig"))`.
      // Let's implement real path:

      let hashToSign: string;
      if (request.payload?.txHex) {
        // If full tx passed, hash it? Stacks logic suggests we sign the presig hash.
        // Assuming payload is the 32-byte hash
        hashToSign = request.payload.hash;
      } else {
        // Generic message
        const cx = Buffer.from(JSON.stringify(request.payload));
        hashToSign = Buffer.from(bitcoin.crypto.sha256(cx)).toString("hex");
      }

      const res = await signNative({
        vault,
        pin,
        path,
        messageHash: hashToSign,
        network: "stacks",
          payload: JSON.stringify(request.payload)
        });

      return {
        signature: res.signature,
        pubkey: res.pubkey,
        timestamp: Date.now(),
      };
    } else if (request.layer === "Liquid") {
        const path = "m/84'/1776'/0'/0/0"; // Liquid Native Segwit

        // Liquid signing often mirrors Bitcoin but with a different network param.
        // If signing a raw hash (like for blinded transactions), we sign just like Bitcoin.
        let hashToSign = "";
        if (typeof request.payload === "string") {
            hashToSign = request.payload; // Already hex?
        } else if (request.payload?.hash) {
            hashToSign = request.payload.hash;
        } else {
            // General Payload
            const cx = Buffer.from(JSON.stringify(request.payload));
            hashToSign = Buffer.from(bitcoin.crypto.sha256(cx)).toString("hex");
        }

        const res = await signNative({
            vault,
            pin,
            path,
            messageHash: hashToSign,
            network: "liquid", // Passed to native if it needs specific network handling (usually just for address fmt or magic bytes),
          payload: JSON.stringify(request.payload)
        });

        return {
            signature: res.signature,
            pubkey: res.pubkey,
            timestamp: Date.now(),
        };
    } else if (request.layer === "BOB") {
      const path = "m/44'/60'/0'/0/0"; // BOB is EVM compatible
      const res = await signNative({
        vault,
        pin,
        path,
        messageHash: (request.payload?.hash || request.payload as string).replace("0x", ""),
        network: "bob",
          payload: JSON.stringify(request.payload)
        });
      return {
        signature: res.signature,
        pubkey: res.pubkey,
        timestamp: Date.now(),
      };
    } else if (request.layer === "RGB") {
      const path = "m/86'/0'/0'/0/0"; // RGB uses Taproot
      const res = await signNative({
        vault,
        pin,
        path,
        messageHash: request.payload?.hash || request.payload as string,
        network: "rgb",
          payload: JSON.stringify(request.payload)
        });
      return {
        signature: res.signature,
        pubkey: res.pubkey,
        timestamp: Date.now(),
      };
    } else if (request.layer === "Ark") {
      const path = "m/84'/0'/0'/1/0"; // Ark VTXO path
      const res = await signNative({
        vault,
        pin,
        path,
        messageHash: request.payload?.hash || request.payload as string,
        network: "ark",
          payload: JSON.stringify(request.payload)
        });
      return {
        signature: res.signature,
        pubkey: res.pubkey,
        timestamp: Date.now(),
      };
    } else if (request.layer === "StateChain") {
      const index = request.payload?.index || 0; const path = `m/84'/0'/0'/2/${index}`; // State Chain path
      const res = await signNative({
        vault,
        pin,
        path,
        messageHash: request.payload?.hash || request.payload as string,
        network: "statechain",
          payload: JSON.stringify(request.payload)
        });
      return {
        signature: res.signature,
        pubkey: res.pubkey,
        timestamp: Date.now(),
      };
    } else if (request.layer === "Maven") {
      const path = "m/84'/0'/0'/3/0"; // Maven path
      const res = await signNative({
        vault,
        pin,
        path,
        messageHash: request.payload?.hash || request.payload as string,
        network: "maven",
          payload: JSON.stringify(request.payload)
        });
      return {
        signature: res.signature,
        pubkey: res.pubkey,
        timestamp: Date.now(),
      };
    } else if (request.layer === "BitVM") {
      const path = "m/84'/0'/0'/4/0"; // BitVM path
      const res = await signNative({
        vault,
        pin,
        path,
        messageHash: request.payload?.hash || request.payload as string,
        network: "bitvm",
          payload: JSON.stringify(request.payload)
        });
      return {
        signature: res.signature,
        pubkey: res.pubkey,
        timestamp: Date.now(),
      };
    } else if (request.layer === "Rootstock" || request.layer === "Ethereum") {
      // RSK / Ethereum
      const path = "m/44'/60'/0'/0/0"; // Standard RSK/ETH

      // Payload is usually a transaction hash (keccak256 hash of rlp encoded tx)
      let hashToSign = "";
      if (typeof request.payload === "string") {
        hashToSign = request.payload.replace("0x", "");
      } else if (request.payload?.hash) {
        hashToSign = request.payload.hash.replace("0x", "");
      } else {
        throw new Error(`Invalid ${request.layer} Payload`);
      }

      const res = await signNative({
        vault,
        pin,
        path,
        messageHash: hashToSign,
        network: request.layer === "Ethereum" ? "ethereum" : "rsk",
          payload: JSON.stringify(request.payload)
        });

      return {
        signature: res.signature, // already hex (r,s,v)
        pubkey: res.pubkey,
        timestamp: Date.now(),
      };
    }

    throw new Error("Native signing for this layer not implemented yet");
  }

  // --- WEB / LEGACY PATH ---
  const seedBytes =
    typeof seedOrVault === "string"
      ? await workerManager.deriveSeed(seedOrVault)
      : (seedOrVault as Uint8Array);

  try {
    let signature = "";
    let pubkey = "";
    let broadcastHex = "";
    let psbtBase64: string | undefined;

    if (request.layer === "Mainnet" && seedBytes) {
      const coin = request.payload?.network === "mainnet" ? 0 : 1;
      const path = `m/84'/${coin}'/0'/0/0`;
      const derived = await workerManager.derivePath(seedBytes, path);
      pubkey = derived.publicKey;

      if (request.payload && request.payload.psbt && request.payload.network) {
        // Use imported helper
        broadcastHex = await signPsbtBase64WithSeed(
          seedBytes!,
          request.payload.psbt,
          request.payload.network,
        );
        psbtBase64 = await signPsbtBase64WithSeedReturnBase64(
          seedBytes!,
          request.payload.psbt,
          request.payload.network
        );
        signature = Buffer.from(
          bitcoin.crypto.sha256(Buffer.from(broadcastHex, "hex")),
        ).toString("hex");
      } else {
        const payloadHash = bitcoin.crypto.sha256(
          Buffer.from(JSON.stringify(request.payload)),
        );
        if (derived.privateKey) {
          const privKeyBuf = Buffer.from(derived.privateKey, 'hex');
          try {
            const child = bip32.fromPrivateKey(privKeyBuf, Buffer.alloc(32));
            signature = Buffer.from(child.sign(Buffer.from(payloadHash))).toString("hex");
          } finally {
            privKeyBuf.fill(0);
          }
        }
        broadcastHex = "";
      }
    } else if (request.layer === "Stacks" && seedBytes) {
      const path = "m/44'/5757'/0'/0/0";
      const derived = await workerManager.derivePath(seedBytes, path);
      pubkey = derived.publicKey;

      if (derived.privateKey) {
          const privKeyBuf = Buffer.from(derived.privateKey, 'hex');
          try {
            const child = bip32.fromPrivateKey(privKeyBuf, Buffer.alloc(32));

            let hashToSign: Buffer;
            if (request.payload?.hash) {
              hashToSign = Buffer.from(request.payload.hash, 'hex');
            } else {
              const cx = Buffer.from(JSON.stringify(request.payload));
              hashToSign = Buffer.from(bitcoin.crypto.sha256(cx));
            }

            signature = Buffer.from(child.sign(hashToSign)).toString("hex");
          } finally {
            privKeyBuf.fill(0);
          }
      }
    }

    return {
      signature,
      pubkey,
      broadcastReadyHex: broadcastHex,
      timestamp: Date.now(),
    };
  } finally {
    // Memory Hardening: Wiping seed bytes from RAM after usage.
    if (seedBytes instanceof Uint8Array) {
      seedBytes.fill(0);
    }
  }
};
