import { Capacitor } from '@capacitor/core';
import { SecureEnclave } from './enclave-storage';

export async function authenticateBiometric(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await SecureEnclave.authenticate({ durationSeconds: 300 });
    return !!res.authenticated;
  } catch {
    return false;
  }
}

export async function clearBiometricSession(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SecureEnclave.clearBiometricSession();
  } catch {
  }
}
