import { registerPlugin, Capacitor } from '@capacitor/core';
import { notificationService } from './notifications';
import { generateRandomString } from './random';

interface PlayIntegrityPlugin {
    requestIntegrityToken(params: { nonce: string }): Promise<{ token: string }>;
}

const PlayIntegrity = registerPlugin<PlayIntegrityPlugin>('PlayIntegrity');

export interface IntegrityVerificationResult {
    success: boolean;
    deviceIntegrity: boolean;
    strongIntegrity: boolean;
    virtualIntegrity: boolean;
    error?: string;
}

/**
 * Service to handle device attestation via Google Play Integrity.
 */
export const requestDeviceAttestation = async (nonce: string): Promise<string | null> => {
    if (!Capacitor.isNativePlatform()) {
        console.info('[Integrity] Web environment - skipping real attestation.');
        return 'web_mock_integrity_token';
    }

    try {
        const { token } = await PlayIntegrity.requestIntegrityToken({ nonce });
        return token;
    } catch (e: any) {
        console.error('[Integrity] Failed to get integrity token:', e);
        return null;
    }
};

/**
 * Verifies an integrity token with the Conxian Gateway.
 */
export const verifyIntegrityToken = async (token: string): Promise<IntegrityVerificationResult> => {
    const gatewayUrl = (import.meta as any).env?.VITE_GATEWAY_URL;

    if (!gatewayUrl || token === 'web_mock_integrity_token') {
        return {
            success: true,
            deviceIntegrity: true,
            strongIntegrity: true,
            virtualIntegrity: false
        };
    }

    try {
        const response = await fetch(`${gatewayUrl}/v1/verify-integrity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        if (!response.ok) throw new Error('Gateway verification failed');

        return await response.json();
    } catch (e: any) {
        console.error('[Integrity] Token verification failed:', e);
        return {
            success: false,
            deviceIntegrity: false,
            strongIntegrity: false,
            virtualIntegrity: false,
            error: e.message
        };
    }
};

/**
 * Comprehensive check to ensure the device is safe for high-value operations.
 */
export const ensureDeviceSafety = async (): Promise<boolean> => {
    const nonce = generateRandomString(12);
    const token = await requestDeviceAttestation(nonce);

    if (!token) {
        notificationService.notify({
            category: 'SYSTEM',
            type: 'error',
            title: 'Security Alert',
            message: 'Device integrity could not be verified. High-value operations restricted.'
        });
        return false;
    }

    const verification = await verifyIntegrityToken(token);

    if (!verification.deviceIntegrity) {
        notificationService.notify({
            category: 'SYSTEM',
            type: 'error',
            title: 'Compromised Device',
            message: 'Your device environment is not genuine. Sovereignty operations are disabled.'
        });
        return false;
    }

    return true;
};
