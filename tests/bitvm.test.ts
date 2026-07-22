import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BITVM_PROOF_SCHEMA_VERSION,
    NUM_TAPS,
    BitVmProofEnvelope,
    BitVmVerificationResult,
    fetchBitVmChallenges,
    initiateDispute,
    signBitVmCommitment,
    validateBitVmProofEnvelope,
    verifyBitVmProof,
} from '../services/bitvm';
import { requestEnclaveSignature } from '../services/signer';

vi.mock('../services/signer', () => ({
    requestEnclaveSignature: vi.fn(),
}));

const signer = vi.mocked(requestEnclaveSignature);

const canonicalEnvelope: BitVmProofEnvelope = {
    schemaVersion: BITVM_PROOF_SCHEMA_VERSION,
    proof: 'deadbeef',
    verificationKeyId: 'bitvm2-research-key',
    verificationKeyDigest: '00'.repeat(32),
    publicInputs: ['input-0', 'input-1'],
    curve: 'bn254',
    circuitId: 'bitvm2-research-circuit',
    encoding: 'hex',
    network: 'mainnet',
    blockContext: {
        height: 840000,
        hash: 'block-hash-binding',
    },
    tapCount: NUM_TAPS,
    tapIndex: 0,
    domainSeparation: 'conxian.bitvm2.dispute.v1',
    transactionBinding: 'transaction-binding',
    stateBinding: 'state-binding',
};

const unsupportedVerification = (): BitVmVerificationResult => ({
    status: 'unsupported',
    authoritative: false,
    reason: 'No reviewed BitVM2 verifier is integrated',
});

const simulatedVerification: BitVmVerificationResult = {
    status: 'simulated',
    simulated: true,
    authoritative: false,
    reason: 'Evaluation-only simulation',
};

const disputeRequest = (verification: BitVmVerificationResult = unsupportedVerification()) => ({
    envelope: canonicalEnvelope,
    verification,
    tapIndex: canonicalEnvelope.tapIndex,
    disputePsbt: 'canonical-dispute-psbt',
    vault: 'test-vault',
});

describe('BitVM service quarantine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(['', 'arbitrary proof', 'INVALID_proof', 'random-bytes', 'mutated-proof'])('rejects raw input %j as malformed', async (proof) => {
        const result = await verifyBitVmProof(proof);

        expect(result.status).toBe('malformed');
        expect(result.status).not.toBe('verified');
    });

    it('returns typed unsupported for a structurally complete envelope', async () => {
        const result = await verifyBitVmProof(canonicalEnvelope);

        expect(result).toEqual({
            status: 'unsupported',
            authoritative: false,
            reason: 'No reviewed BitVM2 verifier is integrated; verification is quarantined',
        });
    });

    it('does not treat a mutated proof or wrong key as verified', async () => {
        const mutated = await verifyBitVmProof({ ...canonicalEnvelope, proof: 'deedbeef' });
        const wrongKey = await verifyBitVmProof({
            ...canonicalEnvelope,
            verificationKeyId: 'unreviewed-key',
            verificationKeyDigest: '11'.repeat(32),
        });

        expect(mutated.status).toBe('unsupported');
        expect(wrongKey.status).toBe('unsupported');
        expect(mutated.status).not.toBe('verified');
        expect(wrongKey.status).not.toBe('verified');
    });

    it('reports missing canonical fields as malformed', async () => {
        const missingPublicInputs = {
            ...canonicalEnvelope,
            publicInputs: undefined,
        } as unknown as BitVmProofEnvelope;
        const result = await verifyBitVmProof(missingPublicInputs as BitVmProofEnvelope);

        expect(result.status).toBe('malformed');
        if (result.status === 'malformed') {
            expect(result.reason).toContain('public inputs');
        }
    });

    it('reports unsupported encodings without attempting verification', async () => {
        const result = await verifyBitVmProof({ ...canonicalEnvelope, encoding: 'stark' });

        expect(result.status).toBe('unsupported');
        if (result.status === 'unsupported') {
            expect(result.reason).toContain('encoding');
        }
    });

    it('rejects invalid tap indices before any signing path', async () => {
        const envelopeResult = validateBitVmProofEnvelope({
            ...canonicalEnvelope,
            tapIndex: NUM_TAPS,
        });
        const disputeResult = await initiateDispute({
            ...disputeRequest(),
            envelope: { ...canonicalEnvelope, tapIndex: NUM_TAPS },
            tapIndex: NUM_TAPS,
        });

        expect(envelopeResult.valid).toBe(false);
        expect(disputeResult.status).toBe('malformed');
        expect(disputeResult.signerInvoked).toBe(false);
        expect(signer).not.toHaveBeenCalled();
    });

    it('returns unavailable instead of fabricating BitVM challenges', async () => {
        const result = await fetchBitVmChallenges('BitVM');

        expect(result.status).toBe('unsupported');
        expect(result.authoritative).toBe(false);
        expect(result).not.toHaveProperty('challenges');
    });

    it('quarantines legacy commitment signing without invoking the signer', async () => {
        const result = await signBitVmCommitment('challenge-id', 'commitment', 'test-vault');

        expect(result.status).toBe('malformed');
        expect(result.signerInvoked).toBe(false);
        expect(signer).not.toHaveBeenCalled();
    });

    it('does not invoke the signer for unsupported verification', async () => {
        const result = await initiateDispute(disputeRequest());

        expect(result).toEqual({
            status: 'unsupported',
            authoritative: false,
            signerInvoked: false,
            reason: 'Dispute signing requires reviewed BitVM2 verification evidence',
        });
        expect(signer).not.toHaveBeenCalled();
    });

    it('does not invoke the signer for simulated verification', async () => {
        const result = await initiateDispute(disputeRequest(simulatedVerification));

        expect(result.status).toBe('simulated');
        expect(result.signerInvoked).toBe(false);
        expect(signer).not.toHaveBeenCalled();
    });

    it('requires canonical state and transaction bindings before signing', async () => {
        const missingBinding = await initiateDispute({
            ...disputeRequest(),
            envelope: { ...canonicalEnvelope, stateBinding: '' },
        });
        const missingTransaction = await initiateDispute({
            ...disputeRequest(),
            disputePsbt: '',
        });

        expect(missingBinding.status).toBe('malformed');
        expect(missingTransaction.status).toBe('malformed');
        expect(signer).not.toHaveBeenCalled();
    });

    it('surfaces signer failure as a typed result', async () => {
        signer.mockRejectedValueOnce(new Error('test signer failure'));
        const reviewedEvidence: BitVmVerificationResult = {
            // This fixture only exercises the downstream signer failure branch;
            // verifyBitVmProof never emits this status in the quarantined build.
            status: 'verified',
            authoritative: true,
            evidence: {
                envelope: canonicalEnvelope,
                verifierRevision: 'test-only-reviewed-boundary',
                verifierDigest: '22'.repeat(32),
            },
        };

        const result = await initiateDispute(disputeRequest(reviewedEvidence));

        expect(result).toEqual({
            status: 'signer_failed',
            authoritative: false,
            signerInvoked: true,
            reason: 'The native enclave signer rejected the BitVM2 dispute transaction',
        });
        expect(signer).toHaveBeenCalledTimes(1);
    });

    it('does not sign a commitment that is not bound to canonical state', async () => {
        const result = await signBitVmCommitment({
            ...disputeRequest(),
            challengeId: 'challenge-id',
            commitment: 'different-state-binding',
        });

        expect(result.status).toBe('malformed');
        expect(result.signerInvoked).toBe(false);
        expect(signer).not.toHaveBeenCalled();
    });
});
