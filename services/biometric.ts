import { authenticateEnclaveBiometric, clearEnclaveBiometricSession } from './enclave-storage';

export async function authenticateBiometric(): Promise<boolean> {
  try {
    return await authenticateEnclaveBiometric(300);
  } catch {
    return false;
  }
}

export async function clearBiometricSession(): Promise<void> {
  try {
    await clearEnclaveBiometricSession();
  } catch {
  }
}
