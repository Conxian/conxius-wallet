import { Capacitor, registerPlugin } from '@capacitor/core';

type SecureEnclavePlugin = {
  isAvailable(): Promise<{ available: boolean }>;
  getItem(options: { key: string }): Promise<{ value: string | null }>;
  setItem(options: { key: string; value: string }): Promise<void>;
  removeItem(options: { key: string }): Promise<void>;
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

export async function getEnclaveBlob(key: string): Promise<string | null> {
  if (await hasNativeSecureEnclave()) {
    try {
      const native = await SecureEnclave.getItem({ key });
      if (native.value != null) return native.value;
    } catch {
    }
    const legacy = localStorage.getItem(key);
    if (legacy != null) {
      try {
        await SecureEnclave.setItem({ key, value: legacy });
        localStorage.removeItem(key);
      } catch {
        return legacy;
      }
      return legacy;
    }
    return null;
  }
  return localStorage.getItem(key);
}

export async function setEnclaveBlob(key: string, value: string): Promise<void> {
  if (await hasNativeSecureEnclave()) {
    try {
      await SecureEnclave.setItem({ key, value });
      localStorage.removeItem(key);
      return;
    } catch {
    }
  }
  localStorage.setItem(key, value);
}

export async function removeEnclaveBlob(key: string): Promise<void> {
  if (await hasNativeSecureEnclave()) {
    try {
      await SecureEnclave.removeItem({ key });
    } catch {
    }
  }
  localStorage.removeItem(key);
}

