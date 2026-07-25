import { Capacitor, registerPlugin } from '@capacitor/core';

type SecureEnclaveNonSigningPlugin = {
  isAvailable(): Promise<{ available: boolean }>;
  hasItem(options: { key: string }): Promise<{ exists: boolean }>;
  getItem(options: { key: string; requireBiometric?: boolean }): Promise<{ value: string | null }>;
  setItem(options: { key: string; value: string; requireBiometric?: boolean }): Promise<void>;
  removeItem(options: { key: string; requireBiometric?: boolean }): Promise<void>;
  authenticate(options?: { durationSeconds?: number }): Promise<{ authenticated: boolean; validUntilMs?: number }>;
  clearBiometricSession(): Promise<void>;
  getPublicKey(options: { vault: string; pin?: string; path: string; network?: string }): Promise<{ pubkey: string }>;
  getDerivedSecret(options: { vault: string; pin?: string; path: string }): Promise<{ secret: string; pubkey: string }>;
  getWalletInfo(options: { vault: string; pin?: string }): Promise<{ btcPubkey: string; stxPubkey: string; liquidPubkey: string; evmAddress: string; taprootAddress?: string }>;
  getSecurityLevel(): Promise<{ level: string; isStrongBox: boolean }>;
};

const plugin = registerPlugin<SecureEnclaveNonSigningPlugin>('SecureEnclave');

export async function hasNativeSecureEnclave(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return !!(await plugin.isAvailable()).available;
  } catch {
    return false;
  }
}

export const secureEnclaveStorage = Object.freeze({
  hasItem: (options: Parameters<SecureEnclaveNonSigningPlugin['hasItem']>[0]) => plugin.hasItem(options),
  getItem: (options: Parameters<SecureEnclaveNonSigningPlugin['getItem']>[0]) => plugin.getItem(options),
  setItem: (options: Parameters<SecureEnclaveNonSigningPlugin['setItem']>[0]) => plugin.setItem(options),
  removeItem: (options: Parameters<SecureEnclaveNonSigningPlugin['removeItem']>[0]) => plugin.removeItem(options),
  authenticate: (options?: Parameters<SecureEnclaveNonSigningPlugin['authenticate']>[0]) => plugin.authenticate(options),
  clearBiometricSession: () => plugin.clearBiometricSession(),
});

export const secureEnclavePublicDerivation = Object.freeze({
  getPublicKey: (options: Parameters<SecureEnclaveNonSigningPlugin['getPublicKey']>[0]) => plugin.getPublicKey(options),
  getDerivedSecret: (options: Parameters<SecureEnclaveNonSigningPlugin['getDerivedSecret']>[0]) => plugin.getDerivedSecret(options),
  getWalletInfo: (options: Parameters<SecureEnclaveNonSigningPlugin['getWalletInfo']>[0]) => plugin.getWalletInfo(options),
  getSecurityLevel: () => plugin.getSecurityLevel(),
});
