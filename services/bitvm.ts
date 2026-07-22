import { Network } from '../types';

export const NUM_TAPS = 364;
export const VALIDATING_TAPS = 1;
export const HASHING_TAPS = 363;
export const BITVM_PROOF_SCHEMA_VERSION = 'conxian.bitvm2.proof.v1';

export const SUPPORTED_BITVM_ENCODINGS = ['hex', 'base64', 'base64url'] as const;
export type BitVmProofEncoding = typeof SUPPORTED_BITVM_ENCODINGS[number];

export interface BitVmBlockContext {
    height: number;
    hash: string;
}

/**
* Canonical BitVM2 proof envelope.
*
* This is an enablement gate, not a cryptographic verifier. A reviewed native
* verifier must consume this exact metadata before any result can be promoted
* to `verified`.
*/
export interface BitVmProofEnvelope {
    schemaVersion: string;
    proof: string;
    verificationKeyId: string;
    verificationKeyDigest: string;
    publicInputs: readonly string[];
    curve: string;
    circuitId: string;
    encoding: string;
    network: Network;
    blockContext: BitVmBlockContext;
    tapCount: number;
    tapIndex: number;
    domainSeparation: string;
    transactionBinding: string;
    stateBinding: string;
}

export interface BitVmProofRequest {
    envelope: BitVmProofEnvelope;
}

/** Backward-compatible type alias for callers that imported `BitVmProof`. */
export type BitVmProof = BitVmProofEnvelope;

/** Reserved for verifier-owned output; caller-constructed evidence is untrusted. */
export interface BitVmVerifiedEvidence {
    envelope: BitVmProofEnvelope;
    verifierRevision: string;
    verifierDigest: string;
}

export type BitVmVerificationResult =
    | {
        status: 'unsupported';
        authoritative: false;
        reason: string;
    }
    | {
        status: 'simulated';
        simulated: true;
        authoritative: false;
        reason: string;
    }
    | {
        status: 'malformed';
        authoritative: false;
        reason: string;
    }
    | {
        status: 'invalid';
        authoritative: false;
        reason: string;
    }
    | {
        status: 'verified';
        authoritative: true;
        evidence: BitVmVerifiedEvidence;
    };

export type BitVmEnvelopeValidation =
    | {
        valid: true;
        envelope: BitVmProofEnvelope;
    }
    | {
        valid: false;
        result: Extract<BitVmVerificationResult, { status: 'malformed' | 'unsupported' }>;
    };

export interface BitVmDisputeRequest {
    envelope: BitVmProofEnvelope;
    verification: BitVmVerificationResult;
    tapIndex: number;
    disputePsbt: string;
    vault: string | Uint8Array;
}

/**
* The signer-related variants remain exported for compatibility with callers
* that already narrow this result type. The quarantined implementation never
* constructs either variant until a reviewed verifier and signing backend
* exist.
*/
export type BitVmDisputeResult =
    | {
        status: 'unsupported' | 'simulated' | 'malformed' | 'invalid';
        authoritative: false;
        signerInvoked: false;
        reason: string;
    }
    | {
        status: 'signer_failed';
        authoritative: false;
        signerInvoked: true;
        reason: string;
    }
    | {
        status: 'signed';
        authoritative: true;
        signerInvoked: true;
        signature: string;
    };

export type BitVmSigningResult = BitVmDisputeResult;

export type BitVmChallengeResult = {
    status: 'unsupported';
    authoritative: false;
    reason: string;
};

const malformed = (reason: string): Extract<BitVmVerificationResult, { status: 'malformed' }> => ({
    status: 'malformed',
    authoritative: false,
    reason,
});

const unsupported = (reason: string): Extract<BitVmVerificationResult, { status: 'unsupported' }> => ({
    status: 'unsupported',
    authoritative: false,
    reason,
});

const disputeFailure = (
    status: Extract<BitVmDisputeResult, { status: 'unsupported' | 'simulated' | 'malformed' | 'invalid' }>['status'],
    reason: string,
): Extract<BitVmDisputeResult, { status: 'unsupported' | 'simulated' | 'malformed' | 'invalid' }> => ({
    status,
    authoritative: false,
    signerInvoked: false,
    reason,
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null
);

const isNonEmptyString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

const isNetwork = (value: unknown): value is Network => (
    value === 'mainnet' || value === 'testnet' || value === 'regtest' || value === 'devnet'
);

const isEncodedProof = (proof: string, encoding: string): boolean => {
    if (encoding === 'hex') {
        const normalized = proof.startsWith('0x') ? proof.slice(2) : proof;
        return normalized.length > 0 && normalized.length % 2 === 0 && /^[0-9a-f]+$/i.test(normalized);
    }

    if (encoding === 'base64') {
        return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(proof);
    }

    if (encoding === 'base64url') {
        return /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}(?:==)?|[A-Za-z0-9_-]{3}=?)?$/.test(proof);
    }

    return false;
};

const isValidTapIndex = (tapIndex: number, tapCount = NUM_TAPS): boolean => (
    Number.isInteger(tapIndex) && tapIndex >= 0 && tapIndex < tapCount
);

/** Validate the non-cryptographic shape and bindings of the canonical envelope. */
export const validateBitVmProofEnvelope = (
    input: BitVmProofEnvelope | BitVmProofRequest | unknown,
    expectedNetwork?: Network,
): BitVmEnvelopeValidation => {
    const candidate = isRecord(input) && 'envelope' in input ? input.envelope : input;

    if (!isRecord(candidate)) {
        return { valid: false, result: malformed('A canonical BitVM2 proof envelope is required') };
    }

    if (candidate.schemaVersion !== BITVM_PROOF_SCHEMA_VERSION) {
        return { valid: false, result: unsupported('The BitVM2 proof schema is not enabled') };
    }

    const requiredStrings = [
        ['proof', candidate.proof],
        ['verificationKeyId', candidate.verificationKeyId],
        ['verificationKeyDigest', candidate.verificationKeyDigest],
        ['curve', candidate.curve],
        ['circuitId', candidate.circuitId],
        ['encoding', candidate.encoding],
        ['domainSeparation', candidate.domainSeparation],
        ['transactionBinding', candidate.transactionBinding],
        ['stateBinding', candidate.stateBinding],
    ] as const;

    for (const [name, value] of requiredStrings) {
        if (!isNonEmptyString(value)) {
            return { valid: false, result: malformed(`Missing canonical BitVM2 field: ${name}`) };
        }
    }

    if (!isNetwork(candidate.network)) {
        return { valid: false, result: malformed('Missing or unsupported BitVM2 network') };
    }

    if (expectedNetwork && candidate.network !== expectedNetwork) {
        return { valid: false, result: malformed('BitVM2 network binding does not match the request') };
    }

    if (!isRecord(candidate.blockContext)) {
        return { valid: false, result: malformed('Missing canonical BitVM2 block context') };
    }

    const blockContext = candidate.blockContext;
    if (typeof blockContext.height !== 'number'
        || !Number.isInteger(blockContext.height)
        || blockContext.height < 0
        || !isNonEmptyString(blockContext.hash)) {
        return { valid: false, result: malformed('Missing canonical BitVM2 block context') };
    }

    if (!Array.isArray(candidate.publicInputs)
        || candidate.publicInputs.length === 0
        || candidate.publicInputs.some(inputValue => !isNonEmptyString(inputValue))) {
        return { valid: false, result: malformed('BitVM2 public inputs must be an ordered non-empty string array') };
    }

    const canonical = candidate as unknown as BitVmProofEnvelope;

    if (!Number.isInteger(canonical.tapCount) || canonical.tapCount !== NUM_TAPS) {
        return { valid: false, result: malformed(`BitVM2 tap count must be exactly ${NUM_TAPS}`) };
    }

    if (!isValidTapIndex(canonical.tapIndex, canonical.tapCount)) {
        return { valid: false, result: malformed('BitVM2 tap index is outside the canonical tap range') };
    }

    if (!SUPPORTED_BITVM_ENCODINGS.includes(canonical.encoding as BitVmProofEncoding)) {
        return { valid: false, result: unsupported('The BitVM2 proof encoding is not supported') };
    }

    if (!isEncodedProof(canonical.proof, canonical.encoding)) {
        return { valid: false, result: malformed('BitVM2 proof bytes do not match the declared encoding') };
    }

    return {
        valid: true,
        envelope: {
            schemaVersion: canonical.schemaVersion,
            proof: canonical.proof,
            verificationKeyId: canonical.verificationKeyId,
            verificationKeyDigest: canonical.verificationKeyDigest,
            publicInputs: [...canonical.publicInputs],
            curve: canonical.curve,
            circuitId: canonical.circuitId,
            encoding: canonical.encoding,
            network: canonical.network,
            blockContext: {
                height: blockContext.height,
                hash: blockContext.hash,
            },
            tapCount: canonical.tapCount,
            tapIndex: canonical.tapIndex,
            domainSeparation: canonical.domainSeparation,
            transactionBinding: canonical.transactionBinding,
            stateBinding: canonical.stateBinding,
        },
    };
};

/**
* Production BitVM2 entrypoint. No reviewed verifier is integrated, so a
* structurally valid envelope is explicitly unavailable in every environment.
*/
export const verifyBridgeProof = async (
    input: BitVmProofEnvelope | BitVmProofRequest | string,
    network: Network = 'mainnet',
): Promise<BitVmVerificationResult> => {
    const validation = validateBitVmProofEnvelope(input, network);
    if (!validation.valid) return validation.result;

    return unsupported('No reviewed BitVM2 verifier is integrated; verification is quarantined');
};

/** Safe alias retained for existing callers; it no longer returns a boolean. */
export const verifyBitVmProof = verifyBridgeProof;

const legacyDisputeFailure = (reason: string): BitVmDisputeResult => (
    disputeFailure('malformed', reason)
);

/**
* Dispute APIs retain structural validation for compatibility, but no
* caller-supplied verification result can authorize a signer while the
* reviewed verifier is unavailable.
*/
export function initiateDispute(request: BitVmDisputeRequest): Promise<BitVmDisputeResult>;
export function initiateDispute(tapIndex: number, rawProof: string, network: Network): Promise<BitVmDisputeResult>;
export async function initiateDispute(
    requestOrTapIndex: BitVmDisputeRequest | number,
    rawProof?: string,
    network?: Network,
): Promise<BitVmDisputeResult> {
    if (typeof requestOrTapIndex === 'number') {
        void rawProof;
        void network;
        return legacyDisputeFailure('Legacy BitVM2 dispute requests lack the canonical proof and transaction bindings');
    }

    const request = requestOrTapIndex;
    if (!isRecord(request)) {
        return disputeFailure('malformed', 'A BitVM2 dispute request object is required');
    }

    const validation = validateBitVmProofEnvelope(request.envelope);
    if (!validation.valid) {
        return disputeFailure(validation.result.status, validation.result.reason);
    }

    if (!isValidTapIndex(request.tapIndex) || request.tapIndex !== validation.envelope.tapIndex) {
        return disputeFailure('malformed', 'BitVM2 dispute tap index is invalid or not bound to the envelope');
    }

    if (!isNonEmptyString(request.disputePsbt)) {
        return disputeFailure('malformed', 'A canonical dispute transaction binding is required before signing');
    }

    const verificationStatus = isRecord(request.verification) ? request.verification.status : undefined;
    switch (verificationStatus) {
        case 'unsupported':
            return disputeFailure('unsupported', 'Dispute signing requires reviewed BitVM2 verification evidence');
        case 'simulated':
            return disputeFailure('simulated', 'Simulated BitVM2 results are never authoritative for signing');
        case 'malformed':
            return disputeFailure('malformed', 'Malformed BitVM2 verification evidence cannot be signed');
        case 'invalid':
            return disputeFailure('invalid', 'Invalid BitVM2 verification evidence cannot be signed');
        case 'verified':
            return disputeFailure(
                'unsupported',
                'Caller-supplied BitVM2 verification evidence cannot authorize signing; the reviewed verifier is unavailable',
            );
        default:
            return disputeFailure('malformed', 'BitVM2 verification evidence has an unknown status');
    }
}

export interface BitVmCommitmentSigningRequest extends BitVmDisputeRequest {
    challengeId: string;
    commitment: string;
}

export function signBitVmCommitment(request: BitVmCommitmentSigningRequest): Promise<BitVmSigningResult>;
export function signBitVmCommitment(challengeId: string, commitment: string, vault: string): Promise<BitVmSigningResult>;
export async function signBitVmCommitment(
    requestOrChallengeId: BitVmCommitmentSigningRequest | string,
    commitment?: string,
    vault?: string,
): Promise<BitVmSigningResult> {
    if (typeof requestOrChallengeId === 'string') {
        void commitment;
        void vault;
        return legacyDisputeFailure('Legacy BitVM2 commitment requests lack canonical verification and transaction bindings');
    }

    const request = requestOrChallengeId;
    if (!isRecord(request)) {
        return disputeFailure('malformed', 'A BitVM2 commitment request object is required');
    }

    if (!isNonEmptyString(request.challengeId) || !isNonEmptyString(request.commitment)) {
        return disputeFailure('malformed', 'BitVM2 challenge and commitment identifiers are required');
    }

    if (!isRecord(request.envelope) || request.commitment !== request.envelope.stateBinding) {
        return disputeFailure('malformed', 'BitVM2 commitment is not bound to the canonical state commitment');
    }

    return initiateDispute(request);
}

/** BitVM challenge discovery remains unavailable; no synthetic challenge is returned. */
export const fetchBitVmChallenges = async (_layer: string): Promise<BitVmChallengeResult> => {
    void _layer;
    return {
        status: 'unsupported',
        authoritative: false,
        reason: 'BitVM2 challenge discovery is unavailable until a reviewed protocol backend exists',
    };
};
