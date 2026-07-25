import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';
import { Capacitor } from "@capacitor/core";
import { signNative, signBatchNative } from "./enclave-storage";
import { finalizeNativePsbt, getNativePsbtSighashes, getNativeUnsignedTxHex } from './app-private/native-psbt';
import { getAddressFromPublicKey } from "@stacks/transactions";
import { deriveLiquidAddress } from "./liquid";
import { keccak_256 } from "@noble/hashes/sha3.js";

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

const NATIVE_LAYER_PATHS: Readonly<Record<string, string>> = Object.freeze({
  Mainnet: "m/84'/0'/0'/0/0",
  Stacks: "m/44'/5757'/0'/0/0",
  Rootstock: "m/44'/60'/0'/0/0",
  Ethereum: "m/44'/60'/0'/0/0",
  Lightning: "m/84'/0'/0'/0/0",
  Liquid: "m/84'/1776'/0'/0/0",
  Runes: "m/86'/0'/0'/0/0",
  Ordinals: "m/86'/0'/0'/0/0",
  BOB: "m/44'/60'/0'/0/0",
  RGB: "m/86'/0'/0'/0/0",
  Ark: "m/84'/0'/0'/1/0",
  BitVM: "m/84'/0'/0'/4/0",
  Maven: "m/84'/0'/0'/3/0",
  B2: "m/44'/60'/0'/0/0",
  Botanix: "m/44'/60'/0'/0/0",
  Mezo: "m/44'/60'/0'/0/0",
  Alpen: "m/44'/60'/0'/0/0",
  Zulu: "m/44'/60'/0'/0/0",
  Bison: "m/44'/60'/0'/0/0",
  Hemi: "m/44'/60'/0'/0/0",
  Nubit: "m/44'/60'/0'/0/0",
  Lorenzo: "m/44'/60'/0'/0/0",
  Citrea: "m/44'/60'/0'/0/0",
  Babylon: "m/44'/60'/0'/0/0",
  Merlin: "m/44'/60'/0'/0/0",
  Bitlayer: "m/44'/60'/0'/0/0",
  TaprootAssets: "m/86'/0'/0'/0/0",
  Silent: "m/352'/0'/0'/0'/0",
});

export interface SignRequest {
  type: 'message' | 'psbt' | 'bip322';
  layer: string;
  payload: any;
  description: string;
}

export interface SignResult {
  signature: string;
  pubkey: string;
  broadcastReadyHex?: string;
  timestamp: number;
}

/**
 * High-level signing interface. Routes to Native Enclave (StrongBox)
 * or secure TypeScript worker based on environment.
 */
export const requestEnclaveSignature = async (
  request: SignRequest,
  vault: string,
): Promise<SignResult> => {
  console.info(`[Signer] Requesting signature for layer: ${request.layer}`);

  if (Capacitor.isNativePlatform()) {
    const pin = undefined; // In production, this is handled by BiometricPrompt
    const network = 'mainnet'; // Remediation: Default to mainnet for production alignment
    let path = NATIVE_LAYER_PATHS[request.layer] ?? NATIVE_LAYER_PATHS.Mainnet;
    if (request.layer === "StateChain") {
        const index = request.payload?.index || 0;
        path = `m/84'/0'/0'/2/${index}`;
    }

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

            const hashes = getNativePsbtSighashes(request.payload.psbt, pubkeyBuf, network);
            const unsignedTx = getNativeUnsignedTxHex(request.payload.psbt, network);

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

            const broadcastHex = finalizeNativePsbt(request.payload.psbt, signatures, pubkeyBuf, network);

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

    } catch (e: unknown) {
        console.error("[Signer] Native signing failed; refusing software fallback");
        throw e;
    }
  }

  throw new Error('NATIVE_VALUE_SIGNER_REQUIRED: production signing is unavailable outside the native enclave');
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
