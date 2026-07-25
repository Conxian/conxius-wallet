import { Capacitor, registerPlugin } from '@capacitor/core';

type NativeValueSigningPlugin = {
  isAvailable(): Promise<{ available: boolean }>;
  signTransaction(options: {
    vault: string;
    pin?: string;
    path: string;
    messageHash: string;
    payload?: string;
    network?: string;
  }): Promise<{ signature: string; pubkey: string }>;
  signBatch(options: {
    vault: string;
    pin?: string;
    path: string;
    hashes: string[];
    network?: string;
    payload?: string;
  }): Promise<{ signatures: { signature: string; pubkey: string }[] }>;
};

const NativeValueSigner = registerPlugin<NativeValueSigningPlugin>('SecureEnclave');

async function requireNativeValueSigner(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('NATIVE_VALUE_SIGNER_REQUIRED: production signing is unavailable outside the native enclave');
  }
  try {
    if ((await NativeValueSigner.isAvailable()).available) return;
  } catch {
    // Normalize plugin probing failures to the same fail-closed result.
  }
  throw new Error('Native Enclave not available');
}

export async function signNativeValue(options: Parameters<NativeValueSigningPlugin['signTransaction']>[0]) {
  await requireNativeValueSigner();
  return NativeValueSigner.signTransaction(options);
}

export async function signNativeValueBatch(options: Parameters<NativeValueSigningPlugin['signBatch']>[0]) {
  await requireNativeValueSigner();
  return NativeValueSigner.signBatch(options);
}
