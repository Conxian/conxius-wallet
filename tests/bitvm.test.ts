import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    BITVM_QUARANTINE_SCHEMA_VERSION,
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

const quarantineEnvelope: BitVmProofEnvelope = {
    schemaVersion: BITVM_QUARANTINE_SCHEMA_VERSION,
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
    envelope: quarantineEnvelope,
    verification,
    tapIndex: quarantineEnvelope.tapIndex,
    disputePsbt: 'quarantine-dispute-psbt',
    vault: 'test-vault',
});

const fabricatedVerifiedEvidence = (): BitVmVerificationResult => ({
    status: 'verified',
    authoritative: true,
    evidence: {
        envelope: quarantineEnvelope,
        verifierRevision: 'caller-fabricated-revision',
        verifierDigest: '22'.repeat(32),
    },
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
        const result = await verifyBitVmProof(quarantineEnvelope);

        expect(result).toEqual({
            status: 'unsupported',
            authoritative: false,
            reason: 'No reviewed BitVM2 verifier is integrated; quarantine verification is unsupported',
        });
    });

    it('matches the shared TypeScript/Kotlin quarantine envelope wire shape', () => {
        const fixture = JSON.parse(readFileSync(new URL('./fixtures/bitvm-quarantine-envelope.json', import.meta.url), 'utf8')) as BitVmProofEnvelope;
        const validation = validateBitVmProofEnvelope(fixture);

        expect(fixture.schemaVersion).toBe(BITVM_QUARANTINE_SCHEMA_VERSION);
        expect(Object.keys(fixture).sort()).toEqual([
            'blockContext',
            'circuitId',
            'curve',
            'domainSeparation',
            'encoding',
            'network',
            'proof',
            'publicInputs',
            'schemaVersion',
            'stateBinding',
            'tapCount',
            'tapIndex',
            'transactionBinding',
            'verificationKeyDigest',
            'verificationKeyId',
        ]);
        expect(Object.keys(fixture.blockContext).sort()).toEqual(['hash', 'height']);
        expect(fixture).not.toHaveProperty('blockHeight');
        expect(fixture).not.toHaveProperty('blockHash');
        expect(validation.valid).toBe(true);
    });

    it('does not treat a mutated proof or wrong key as verified', async () => {
        const mutated = await verifyBitVmProof({ ...quarantineEnvelope, proof: 'deedbeef' });
        const wrongKey = await verifyBitVmProof({
            ...quarantineEnvelope,
            verificationKeyId: 'unreviewed-key',
            verificationKeyDigest: '11'.repeat(32),
        });

        expect(mutated.status).toBe('unsupported');
        expect(wrongKey.status).toBe('unsupported');
        expect(mutated.status).not.toBe('verified');
        expect(wrongKey.status).not.toBe('verified');
    });

    it('reports missing quarantine fields as malformed', async () => {
        const missingPublicInputs = {
            ...quarantineEnvelope,
            publicInputs: undefined,
        } as unknown as BitVmProofEnvelope;
        const result = await verifyBitVmProof(missingPublicInputs as BitVmProofEnvelope);

        expect(result.status).toBe('malformed');
        if (result.status === 'malformed') {
            expect(result.reason).toContain('public inputs');
        }
    });

    it('reports unsupported encodings without attempting verification', async () => {
        const result = await verifyBitVmProof({ ...quarantineEnvelope, encoding: 'stark' });

        expect(result.status).toBe('unsupported');
        if (result.status === 'unsupported') {
            expect(result.reason).toContain('encoding');
        }
    });

    it('rejects invalid tap indices before any signing path', async () => {
        const envelopeResult = validateBitVmProofEnvelope({
            ...quarantineEnvelope,
            tapIndex: NUM_TAPS,
        });
        const disputeResult = await initiateDispute({
            ...disputeRequest(),
            envelope: { ...quarantineEnvelope, tapIndex: NUM_TAPS },
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

    it('requires quarantine state and transaction bindings before signing', async () => {
        const missingBinding = await initiateDispute({
            ...disputeRequest(),
            envelope: { ...quarantineEnvelope, stateBinding: '' },
        });
        const missingTransaction = await initiateDispute({
            ...disputeRequest(),
            disputePsbt: '',
        });

        expect(missingBinding.status).toBe('malformed');
        expect(missingTransaction.status).toBe('malformed');
        expect(signer).not.toHaveBeenCalled();
    });

    it('rejects caller-fabricated authoritative evidence in initiateDispute', async () => {
        signer.mockResolvedValueOnce({ signature: 'must-not-be-used', pubkey: 'must-not-be-used', timestamp: Date.now() });

        const result = await initiateDispute(disputeRequest(fabricatedVerifiedEvidence()));

        expect(result).toEqual({
            status: 'unsupported',
            authoritative: false,
            signerInvoked: false,
            reason: 'Caller-supplied BitVM2 verification evidence cannot authorize signing; the reviewed verifier is unavailable',
        });
        expect(signer).not.toHaveBeenCalled();
    });

    it('rejects caller-fabricated authoritative evidence in signBitVmCommitment', async () => {
        signer.mockResolvedValueOnce({ signature: 'must-not-be-used', pubkey: 'must-not-be-used', timestamp: Date.now() });

        const result = await signBitVmCommitment({
            ...disputeRequest(fabricatedVerifiedEvidence()),
            challengeId: 'challenge-id',
            commitment: quarantineEnvelope.stateBinding,
        });

        expect(result).toEqual({
            status: 'unsupported',
            authoritative: false,
            signerInvoked: false,
            reason: 'Caller-supplied BitVM2 verification evidence cannot authorize signing; the reviewed verifier is unavailable',
        });
        expect(signer).not.toHaveBeenCalled();
    });

    it('does not sign a commitment that is not bound to quarantine state', async () => {
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
