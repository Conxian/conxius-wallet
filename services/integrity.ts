import { Capacitor } from '@capacitor/core';
import { checkDeviceIntegrity } from './device-integrity';
import { notificationService } from './notifications';

/**
 * System Integrity Service (v1.1)
 *
 * Coordinates device integrity checks and enforces security policies.
 * Consistent with the Sovereign Architect's requirements for "Citadel Native" security.
 */
export const verifySystemIntegrity = async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return true;

    try {
        const result = await checkDeviceIntegrity();

        if (!result.isSecure) {
            notificationService.notify({
                category: 'SYSTEM',
                type: 'error',
                title: 'Security Compromise',
                message: 'Device integrity check failed. Sovereign features disabled for protection.'
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error('[Integrity] Verification failed:', error);
        return false;
    }
};

/**
 * Enforces a security gate for high-risk operations.
 */
export const securityGate = async <T>(operation: () => Promise<T>): Promise<T> => {
    const isSecure = await verifySystemIntegrity();
    if (!isSecure) throw new Error('Security integrity check failed');
    return await operation();
};
