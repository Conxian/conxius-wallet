import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';
import { getAddressFromPublicKey } from "@stacks/transactions";
import { deriveLiquidAddress } from "./liquid";
import { keccak_256 } from "@noble/hashes/sha3.js";

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

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
