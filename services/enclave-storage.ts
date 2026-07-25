import {
  hasNativeSecureEnclave,
  secureEnclavePublicDerivation,
  secureEnclaveStorage,
} from './app-private/secure-enclave-non-signing';

export async function hasEnclaveBlob(key: string): Promise<boolean> {
  if (await hasNativeSecureEnclave()) {
    try {
      const res = await secureEnclaveStorage.hasItem({ key });
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
      const native = await secureEnclaveStorage.getItem({ key, requireBiometric: opts?.requireBiometric ?? false });
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
      await secureEnclaveStorage.setItem({ key, value, requireBiometric: opts?.requireBiometric ?? false });
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
      await secureEnclaveStorage.removeItem({ key, requireBiometric: opts?.requireBiometric ?? false });
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
      await secureEnclaveStorage.clearBiometricSession();
    } catch {
    }
  }
}

export async function authenticateEnclaveBiometric(durationSeconds = 300): Promise<boolean> {
  if (await hasNativeSecureEnclave()) {
    return !!(await secureEnclaveStorage.authenticate({ durationSeconds })).authenticated;
  }
  return false;
}

export async function getPublicKeyNative(options: {
  vault: string;
  pin?: string;
  path: string;
  network?: string;
}): Promise<{ pubkey: string }> {
  if (await hasNativeSecureEnclave()) {
    return await secureEnclavePublicDerivation.getPublicKey(options);
  }
  throw new Error("Native Enclave not available");
}

export async function getDerivedSecretNative(options: {
  vault: string;
  pin?: string;
  path: string;
}): Promise<{ secret: string; pubkey: string }> {
  if (await hasNativeSecureEnclave()) {
    return await secureEnclavePublicDerivation.getDerivedSecret(options);
  }
  throw new Error("Native Enclave not available");
}

export async function getWalletInfoNative(options: {
  vault: string;
  pin?: string;
}): Promise<{ btcPubkey: string; stxPubkey: string; liquidPubkey: string; evmAddress: string; taprootAddress?: string }> {
  if (await hasNativeSecureEnclave()) {
    return await secureEnclavePublicDerivation.getWalletInfo(options);
  }
  throw new Error("Native Enclave not available");
}

export async function getSecurityLevelNative(): Promise<{ level: string; isStrongBox: boolean }> {
  if (await hasNativeSecureEnclave()) {
    return await secureEnclavePublicDerivation.getSecurityLevel();
  }
  return { level: 'WEB', isStrongBox: false };
}

export const STORAGE_KEY = 'conxius_vault';

export async function persistState(state: any, pin?: string): Promise<void> {
  const blob = JSON.stringify(state);
  await setEnclaveBlob(STORAGE_KEY, blob);
}
