import { Capacitor, registerPlugin } from '@capacitor/core';

type SecureEnclavePlugin = {
  isAvailable(): Promise<{ available: boolean }>;
  hasItem(options: { key: string }): Promise<{ exists: boolean }>;
  getItem(options: {
    key: string;
    requireBiometric?: boolean;
  }): Promise<{ value: string | null }>;
  setItem(options: {
    key: string;
    value: string;
    requireBiometric?: boolean;
  }): Promise<void>;
  removeItem(options: {
    key: string;
    requireBiometric?: boolean;
  }): Promise<void>;
  authenticate(options?: {
    durationSeconds?: number;
  }): Promise<{ authenticated: boolean; validUntilMs?: number }>;
  clearBiometricSession(): Promise<void>;
  signTransaction(options: {
    vault: string;
    pin?: string; // Made optional as per instruction
    path: string;
    messageHash: string; payload?: string;
    network?: string;
  }): Promise<{ signature: string; pubkey: string }>;
  unlockSession(options: {
    vault: string;
    pin: string;
  }): Promise<{ unlocked: boolean }>;
  getPublicKey(options: {
    vault: string;
    pin?: string;
    path: string;
    network?: string;
  }): Promise<{ pubkey: string }>;
  getDerivedSecret(options: {
    vault: string;
    pin?: string;
    path: string;
  }): Promise<{ secret: string; pubkey: string }>;
  getWalletInfo(options: {
    vault: string;
    pin?: string;
  }): Promise<{ btcPubkey: string; stxPubkey: string; liquidPubkey: string; evmAddress: string; taprootAddress?: string }>;
  getSecurityLevel(): Promise<{ level: string; isStrongBox: boolean }>;
};

const SecureEnclave = registerPlugin<SecureEnclavePlugin>('SecureEnclave');

async function hasNativeSecureEnclave() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await SecureEnclave.isAvailable();
    return !!res.available;
  } catch {
    return false;
  }
}

export async function hasEnclaveBlob(key: string): Promise<boolean> {
  if (await hasNativeSecureEnclave()) {
    try {
      const res = await SecureEnclave.hasItem({ key });
      return !!res.exists;
    } catch {
      return false;
    }
  }
  return localStorage.getItem(key) != null || sessionStorage.getItem(key) != null;
}

export async function getEnclaveBlob(key: string, opts?: { requireBiometric?: boolean }): Promise<string | null> {
  if (await hasNativeSecureEnclave()) {
    try {
      const native = await SecureEnclave.getItem({ key, requireBiometric: opts?.requireBiometric ?? false });
      if (native.value != null) return native.value;
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : '';
      if ((opts?.requireBiometric ?? false) && msg.toLowerCase().includes('auth required')) {
        throw new Error("auth required", { cause: e });
      }
    }
    // Fallback to localStorage if native fails or item not found (for migration)
    return localStorage.getItem(key);
  }

  // Web Path: Prefer localStorage for persistence across sessions
  const local = localStorage.getItem(key);
  if (local != null) return local;

  return sessionStorage.getItem(key);
}

export async function setEnclaveBlob(key: string, value: string, opts?: { requireBiometric?: boolean }): Promise<void> {
  if (await hasNativeSecureEnclave()) {
    try {
      await SecureEnclave.setItem({ key, value, requireBiometric: opts?.requireBiometric ?? false });
      // Clean up web storage if we successfully saved to native
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      return;
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : '';
      if ((opts?.requireBiometric ?? false) && msg.toLowerCase().includes('auth required')) {
        throw new Error("auth required", { cause: e });
      }
    }
  }

  // Web Path: Save to localStorage for persistence
  localStorage.setItem(key, value);
}

export async function removeEnclaveBlob(key: string, opts?: { requireBiometric?: boolean }): Promise<void> {
  if (await hasNativeSecureEnclave()) {
    try {
      await SecureEnclave.removeItem({ key, requireBiometric: opts?.requireBiometric ?? false });
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : '';
      if ((opts?.requireBiometric ?? false) && msg.toLowerCase().includes('auth required')) {
        throw new Error("auth required", { cause: e });
      }
    }
  }
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export async function clearEnclaveBiometricSession(): Promise<void> {
  if (await hasNativeSecureEnclave()) {
    try {
      await SecureEnclave.clearBiometricSession();
    } catch {
    }
  }
}

export async function authenticateEnclaveBiometricSession(durationSeconds = 300): Promise<boolean> {
  if (!await hasNativeSecureEnclave()) return false;
  const result = await SecureEnclave.authenticate({ durationSeconds });
  return result.authenticated;
}

const NON_VALUE_SIGNING_PROFILES = Object.freeze({
  'wallet-message': Object.freeze({ domain: 'conxius.wallet.message', path: "m/84'/0'/0'/0/0", networks: ['mainnet'] as const }),
  'wallet-bip322': Object.freeze({ domain: 'conxius.wallet.bip322', path: "m/84'/0'/0'/0/0", networks: ['mainnet'] as const }),
  'identity-login': Object.freeze({ domain: 'conxius.identity.login', path: "m/84'/0'/0'/0/0", networks: ['mainnet', 'testnet'] as const }),
  'web5-identity': Object.freeze({ domain: 'conxius.web5.identity', path: "m/84'/0'/0'/6/0", networks: ['web5'] as const }),
  'nostr-evaluation': Object.freeze({ domain: 'conxius.nostr.evaluation', path: "m/44'/1237'/0'/0/0", networks: ['mainnet'] as const }),
} as const);

export type NonValueNativeSigningPurpose = keyof typeof NON_VALUE_SIGNING_PROFILES;

export interface NonValueNativeSigningRequest {
  readonly intentClass: 'non-value-message';
  readonly purpose: NonValueNativeSigningPurpose;
  readonly domain: typeof NON_VALUE_SIGNING_PROFILES[NonValueNativeSigningPurpose]['domain'];
  readonly vault: string;
  readonly messageHash: string;
  readonly network?: string;
}

function assertNonValueNativeSigningRequest(value: unknown): asserts value is NonValueNativeSigningRequest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Malformed non-value native signing request.');
  }
  const request = value as Record<string, unknown>;
  const keys = Object.keys(request).sort();
  const allowed = ['domain', 'intentClass', 'messageHash', 'network', 'purpose', 'vault'];
  if (keys.some((key) => !allowed.includes(key))) {
    throw new Error('Value-shaped native signing input is not allowed.');
  }
  if (request.intentClass !== 'non-value-message'
    || typeof request.purpose !== 'string'
    || !(request.purpose in NON_VALUE_SIGNING_PROFILES)
    || typeof request.vault !== 'string'
    || request.vault.length === 0
    || typeof request.messageHash !== 'string'
    || !/^[0-9a-f]{64}$/i.test(request.messageHash)) {
    throw new Error('Malformed non-value native signing request.');
  }
  const profile = NON_VALUE_SIGNING_PROFILES[request.purpose as NonValueNativeSigningPurpose];
  if (request.domain !== profile.domain) {
    throw new Error('Non-value native signing domain does not match its purpose.');
  }
  if (request.network !== undefined && !(profile.networks as readonly string[]).includes(request.network as string)) {
    throw new Error('Non-value native signing network does not match its purpose.');
  }
}

/** Narrow native signing boundary for domain-separated, non-value message hashes only. */
export async function signNonValueMessageNative(
  request: NonValueNativeSigningRequest,
): Promise<{ signature: string; pubkey: string }> {
  assertNonValueNativeSigningRequest(request);
  if (await hasNativeSecureEnclave()) {
    const profile = NON_VALUE_SIGNING_PROFILES[request.purpose];
    return await SecureEnclave.signTransaction({
      vault: request.vault,
      path: profile.path,
      messageHash: request.messageHash,
      network: request.network ?? profile.networks[0],
    });
  }
  throw new Error("Native Enclave not available");
}

export async function getPublicKeyNative(options: {
  vault: string;
  pin?: string;
  path: string;
  network?: string;
}): Promise<{ pubkey: string }> {
  if (await hasNativeSecureEnclave()) {
    return await SecureEnclave.getPublicKey(options);
  }
  throw new Error("Native Enclave not available");
}

export async function getDerivedSecretNative(options: {
  vault: string;
  pin?: string;
  path: string;
}): Promise<{ secret: string; pubkey: string }> {
  if (await hasNativeSecureEnclave()) {
    return await SecureEnclave.getDerivedSecret(options);
  }
  throw new Error("Native Enclave not available");
}

export async function getWalletInfoNative(options: {
  vault: string;
  pin?: string;
}): Promise<{ btcPubkey: string; stxPubkey: string; liquidPubkey: string; evmAddress: string; taprootAddress?: string }> {
  if (await hasNativeSecureEnclave()) {
    return await SecureEnclave.getWalletInfo(options);
  }
  throw new Error("Native Enclave not available");
}

export async function getSecurityLevelNative(): Promise<{ level: string; isStrongBox: boolean }> {
  if (await hasNativeSecureEnclave()) {
    return await SecureEnclave.getSecurityLevel();
  }
  return { level: 'WEB', isStrongBox: false };
}

export const STORAGE_KEY = 'conxius_vault';

export async function persistState(state: any, pin?: string): Promise<void> {
  const blob = JSON.stringify(state);
  await setEnclaveBlob(STORAGE_KEY, blob);
}
