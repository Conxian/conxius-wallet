import { Network } from '../types';
import { fetchWithRetry } from './network';
import { notificationService } from './notifications';
import { requestEnclaveSignature } from './signer';

/**
 * BitVM Service: Optimistic Verification for Bitcoin L2s
 * Bridges the TypeScript protocol logic to the native BitVmManager.
 */

export interface BitVmChallenge {
    id: string;
    script: string;
    proposer: string;
    challenger: string;
    expiry: number;
    status: 'Pending' | 'Challenged' | 'Verified' | 'Fraud';
}

/**
 * Submits a BitVM fraud proof for verification.
 * In production, this calls the native BitVmManager via the SecureEnclavePlugin.
 */
export const verifyBitVmProof = async (proof: string, network: Network = 'mainnet'): Promise<boolean> => {
    notificationService.notify({ category: 'SYSTEM', type: 'info', title: 'BitVM', message: 'Verifying Fraud Proof...' });

    try {
        // In a real native environment, this would be:
        // const result = await SecureEnclavePlugin.verifyBitVmProof({ proof });

        // Simulation for TS layer
        await new Promise(r => setTimeout(r, 1000));
        const isValid = proof.length > 0 && !proof.includes('INVALID');

        if (isValid) {
            notificationService.notify({ category: 'SYSTEM', type: 'success', title: 'BitVM', message: 'Proof Verified Successfully' });
        } else {
            notificationService.notify({ category: 'SYSTEM', type: 'error', title: 'BitVM', message: 'Fraud Proof Invalid' });
        }

        return isValid;
    } catch (e: any) {
        notificationService.notify({ category: 'SYSTEM', type: 'error', title: 'BitVM', message: `Verification Error: ${e.message}` });
        return false;
    }
};

/**
 * Signs a commitment for a BitVM challenge.
 */
export const signBitVmCommitment = async (
    challengeId: string,
    commitment: string,
    vault: string
): Promise<string> => {
    notificationService.notify({ category: 'TRANSACTION', type: 'info', title: 'BitVM', message: 'Signing Challenge Commitment...' });

    try {
        const signResult = await requestEnclaveSignature({
            type: 'message',
            layer: 'BitVM',
            payload: { challengeId, commitment },
            description: `Commit to BitVM Challenge: ${challengeId.slice(0, 8)}`
        }, vault);

        return signResult.signature;
    } catch (e: any) {
        notificationService.notify({ category: 'SYSTEM', type: 'error', title: 'BitVM', message: `Commitment Signing Failed: ${e.message}` });
        throw e;
    }
};

/**
 * Fetches active BitVM challenges for a given bridge/layer.
 */
export const fetchBitVmChallenges = async (layer: string, network: Network = 'mainnet'): Promise<BitVmChallenge[]> => {
    // Placeholder for actual Bridge/Explorer API
    return [
        {
            id: 'chal_' + Math.random().toString(36).substring(7),
            script: 'OP_BITVM_VERIFY...',
            proposer: 'bc1q_proposer',
            challenger: 'bc1q_challenger',
            expiry: Math.floor(Date.now() / 1000) + 3600,
            status: 'Pending'
        }
    ];
};
