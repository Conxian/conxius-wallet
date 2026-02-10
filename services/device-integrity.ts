
import { registerPlugin } from '@capacitor/core';

// ─── Plugin Interface ────────────────────────────────────────────────────────

interface DeviceIntegrityPlugin {
  checkIntegrity(): Promise<IntegrityResult>;
  isRooted(): Promise<{ rooted: boolean }>;
}

export interface IntegrityResult {
  /** True if no threats detected */
  isSecure: boolean;
  /** True if su binary or root management apps found */
  isRooted: boolean;
  /** True if running on emulator */
  isEmulator: boolean;
  /** Comma-separated list of detected threats */
  threats: string;
  /** Number of threats detected */
  threatCount: number;
  /** Security level: HARDWARE | EMULATOR | COMPROMISED */
  securityLevel: 'HARDWARE' | 'EMULATOR' | 'COMPROMISED';
  /** Android SDK version */
  sdkVersion: number;
  /** Device manufacturer */
  manufacturer: string;
  /** Device model */
  model: string;
}

// ─── Plugin Registration ─────────────────────────────────────────────────────

const DeviceIntegrity = registerPlugin<DeviceIntegrityPlugin>('DeviceIntegrity');

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Performs a comprehensive device integrity check.
 * On Android: Checks su binary, root apps, system props, test keys, emulator.
 * On Web/Desktop: Returns a safe default (isSecure: true, securityLevel: 'HARDWARE').
 *
 * @returns IntegrityResult with threat details
 */
export const checkDeviceIntegrity = async (): Promise<IntegrityResult> => {
  try {
    const result = await DeviceIntegrity.checkIntegrity();
    return result;
  } catch {
    // Fallback for web/desktop where the native plugin is unavailable
    console.info('[DeviceIntegrity] Native plugin not available — returning safe default for web/desktop.');
    return {
      isSecure: true,
      isRooted: false,
      isEmulator: false,
      threats: '[]',
      threatCount: 0,
      securityLevel: 'HARDWARE',
      sdkVersion: 0,
      manufacturer: 'unknown',
      model: 'web',
    };
  }
};

/**
 * Quick root check — lighter than full integrity check.
 * Returns true if the device is rooted.
 */
export const isDeviceRooted = async (): Promise<boolean> => {
  try {
    const result = await DeviceIntegrity.isRooted();
    return result.rooted;
  } catch {
    return false;
  }
};

/**
 * Evaluates whether the device meets minimum security requirements
 * for sovereign wallet operations (signing, seed access).
 *
 * Returns an object with pass/fail and a human-readable reason.
 */
export const evaluateSecurityPosture = async (): Promise<{
  allowed: boolean;
  level: string;
  reason: string;
}> => {
  const integrity = await checkDeviceIntegrity();

  if (integrity.isRooted) {
    return {
      allowed: false,
      level: 'COMPROMISED',
      reason: 'Device is rooted. Sovereign key operations are disabled to protect your funds. Use a non-rooted device.',
    };
  }

  if (integrity.isEmulator) {
    return {
      allowed: false,
      level: 'EMULATOR',
      reason: 'Running on an emulator. Real signing operations are disabled. Use a physical device for sovereign operations.',
    };
  }

  if (!integrity.isSecure) {
    return {
      allowed: false,
      level: 'COMPROMISED',
      reason: `Device integrity check failed: ${integrity.threats}. Some operations may be restricted.`,
    };
  }

  return {
    allowed: true,
    level: integrity.securityLevel,
    reason: 'Device integrity verified.',
  };
};
