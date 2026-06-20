import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyBitVmProof, fetchBitVmChallenges, signBitVmCommitment } from '../services/bitvm';
import { notificationService } from '../services/notifications';

vi.mock('../services/notifications', () => ({
    notificationService: {
        notify: vi.fn()
    }
}));

vi.mock('../services/signer', () => ({
    requestEnclaveSignature: vi.fn().mockResolvedValue({ signature: 'mock_signature' })
}));

describe('BitVM Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should verify a valid proof', async () => {
        const result = await verifyBitVmProof('valid_proof');
        expect(result).toBe(true);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            title: 'BitVM',
            message: 'Proof Verified Successfully'
        }));
    });

    it('should fail verification for invalid proof', async () => {
        const result = await verifyBitVmProof('INVALID_proof');
        expect(result).toBe(false);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            title: 'BitVM',
            message: 'Fraud Proof Invalid'
        }));
    });

    it('should sign a challenge commitment', async () => {
        const signature = await signBitVmCommitment('chal_123', 'commitment_data', 'mock_vault');
        expect(signature).toBe('mock_signature');
    });

    it('should fetch active challenges', async () => {
        const challenges = await fetchBitVmChallenges('mock_layer');
        expect(challenges.length).toBeGreaterThan(0);
        expect(challenges[0].status).toBe('Pending');
    });
});
