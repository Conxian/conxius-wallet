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
  signBatch(options: { vault: string; pin?: string; path: string; hashes: string[]; network?: string; payload?: string; }): Promise<{ signatures: { signature: string; pubkey: string }[] }>; signTransaction(options: {
    vault: string;
    pin?: string; // Made optional as per instruction
    path: string;
    messageHash: string;
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
  getSecurityLevel(): Promise<{ level: string; isStrongBox: boolean }>;
    vault: string;
    pin?: string;
  }): Promise<{ btcPubkey: string; stxPubkey: string; liquidPubkey: string; evmAddress: string; taprootAddress?: string }>;
};

const SecureEnclave = registerPlugin<SecureEnclavePlugin>('SecureEnclave');

export { SecureEnclave }; // Export the plugin instance for direct access if needed

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
        throw new Error('auth required');
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
        throw new Error('auth required');
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
        throw new Error('auth required');
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

export async function signNative(options: {
  vault: string;
  pin?: string;
  path: string;
  messageHash: string;
  network?: string;
}): Promise<{ signature: string; pubkey: string }> {
  if (await hasNativeSecureEnclave()) {
    return await SecureEnclave.signTransaction(options);
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

export async function signBatchNative(options: {
  vault: string;
  pin?: string;
  path: string;
  hashes: string[];
  network?: string;
  payload?: string;
}): Promise<{ signatures: { signature: string; pubkey: string }[] }> {
  if (await hasNativeSecureEnclave()) {
    return await SecureEnclave.signBatch(options);
  }
  throw new Error("Native Enclave not available");
}

export async function getSecurityLevelNative(): Promise<{ level: string; isStrongBox: boolean }> {
  if (await hasNativeSecureEnclave()) {
    return await SecureEnclave.getSecurityLevel();
  }
  return { level: 'WEB', isStrongBox: false };
}
