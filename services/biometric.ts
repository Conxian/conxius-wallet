import { Capacitor } from '@capacitor/core';
import { authenticateEnclaveBiometricSession, clearEnclaveBiometricSession } from './enclave-storage';

export async function authenticateBiometric(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return authenticateEnclaveBiometricSession(300);
  } catch {
    return false;
  }
}

export async function clearBiometricSession(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await clearEnclaveBiometricSession();
  } catch {
  }
}
