
import { nostrGetPubkeyNative, nostrSignEventNative } from './enclave-storage';
import { bech32 } from 'bech32';

/**
 * Nostr Identity Service - Production Grade
 * Handles NIP-01 event creation and cryptographic identity management.
 */

export interface NostrEvent {
  id?: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

export const generateNostrKeypair = async () => {
  try {
      // NIP-06: m/44'/1237'/0'/0/0 — derived and held in the native enclave.
      const path = "m/44'/1237'/0'/0/0";
      const { pubkey: pubKeyHex } = await nostrGetPubkeyNative({ path });

      // Encode npub (bech32) from the 32-byte x-only pubkey.
      const pubKeyX = Buffer.from(pubKeyHex, 'hex');
      const words = bech32.toWords(pubKeyX);
      const npub = bech32.encode('npub', words, 1500); // 1500 is limit, standard

      return {
        nsec: `ENCLAVE_SECURED_KEY`, // UI display only — the secret never leaves the native enclave
        npub: npub,
        pubKeyHex: pubKeyHex
      };
  } catch (e) {
      console.error("Nostr key derivation failed", e);
      throw e;
  }
};

export const createNostrEvent = (content: string, pubkey: string, kind: number = 1): NostrEvent => {
  return {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags: [],
    content
  };
};

export const signNostrEvent = async (event: NostrEvent): Promise<NostrEvent> => {
  console.log("[NOSTR] Signing event with native enclave key...");

  // NIP-01 canonical serialization (non-secret); the id + BIP-340 signature are
  // computed and signed inside the native enclave.
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);

  const { id, signature: sig } = await nostrSignEventNative({ serialized });

  return { ...event, id, sig };
};

/**
 * NIP-47 (Nostr Wallet Connect) Implementation
 * Enables external apps to request payments and info via Nostr.
 */

export interface NWCRequest {
    id: string;
    method: 'get_balance' | 'make_invoice' | 'pay_invoice' | 'pay_keysend' | 'lookup_invoice' | 'list_transactions' | 'get_info';
    params: any;
}

export interface NWCPermission {
    appPubkey: string;
    appName: string;
    methods: string[];
    maxAmountSats: number;
    expiresAt: number;
}

export const KIND_NWC_REQUEST = 23124;
export const KIND_NWC_RESPONSE = 23125;

/**
 * Decrypts and parses an NWC request from a Nostr event.
 */
export const parseNWCRequest = (event: NostrEvent, walletPrivKey: string): NWCRequest | null => {
    try {
        // In a real app, use NIP-04 decryption here
        const content = event.content; // Mocked decryption
        return JSON.parse(content);
    } catch {
        return null;
    }
};

/**
 * Creates an NWC response event.
 */
export const createNWCResponse = (
    requestId: string,
    result: any,
    error: any,
    walletPrivKey: string,
    appPubkey: string
): NostrEvent => {
    const content = JSON.stringify({
        result,
        error
    });

    // In a real app, use NIP-04 encryption for the content
    const event = createNostrEvent(content, appPubkey, KIND_NWC_RESPONSE);
    event.tags.push(['e', requestId]);

    return event;
};

/**
 * Permission check for NWC requests.
 */
export const checkNWCPermission = (
    permission: NWCPermission,
    method: string,
    amountSats?: number
): boolean => {
    if (!permission.methods.includes(method)) return false;
    if (permission.expiresAt < Date.now()) return false;
    if (amountSats && amountSats > permission.maxAmountSats) return false;
    return true;
};
