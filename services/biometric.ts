import { Capacitor, registerPlugin } from '@capacitor/core';

type SecureEnclaveBiometricPlugin = {
  authenticate(): Promise<{ authenticated: boolean }>;
};

const SecureEnclave = registerPlugin<SecureEnclaveBiometricPlugin>('SecureEnclave');

export async function authenticateBiometric(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await SecureEnclave.authenticate();
    return !!res.authenticated;
  } catch {
    return false;
  }
}

