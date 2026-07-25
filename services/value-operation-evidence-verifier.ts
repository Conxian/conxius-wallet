import type { CanonicalValue, ProtocolKeyCustody, ValueOperationIntent } from './value-operation-gate';

export type EvidenceVerificationReason =
    | 'missing_provider_evidence'
    | 'malformed_provider_evidence'
    | 'stale_provider_evidence'
    | 'unsupported_provider'
    | 'unsupported_protocol_key_custody'
    | 'revoked_provider_evidence'
    | 'mismatched_provider_evidence'
    | 'non_authoritative_provider_evidence'
    | 'replayed_provider_evidence'
    | 'unavailable_provider_evidence'
    | 'simulated_provider_evidence'
    | 'debug_provider_evidence'
    | 'synthetic_provider_evidence'
    | 'malformed_value_operation'
    | 'malformed_protocol_key_custody'
    | 'envelope_digest_mismatch';

export interface EvidenceVerificationRequest {
    readonly intent: Readonly<Omit<ValueOperationIntent, 'payload'>>;
    readonly intentDigest: string;
    readonly canonicalOperationDigest: string;
    readonly confirmation: Readonly<{ confirmationId: string; intentDigest: string }>;
    readonly custody: Readonly<ProtocolKeyCustody>;
    readonly opaqueEvidence?: CanonicalValue;
}

export interface VerifiedEvidenceBinding {
    readonly kind: 'verified';
    readonly resultClass: 'authoritative';
    readonly providerStatus: 'verified';
    readonly evidenceStatus: 'verified';
    readonly providerDigest: string;
    readonly evidenceDigest: string;
    readonly boundEnvelopeDigest: string;
    /** Wallet-local defense-in-depth deadline; not authoritative evidence freshness. */
    readonly localAuthorizationExpiresAtMs: number;
}

export type EvidenceVerificationResult =
    | VerifiedEvidenceBinding
    | Readonly<{ kind: 'rejected'; reason:
        | 'missing_provider_evidence'
        | 'malformed_provider_evidence'
        | 'stale_provider_evidence'
        | 'mismatched_provider_evidence'
        | 'non_authoritative_provider_evidence'
        | 'malformed_value_operation'
        | 'malformed_protocol_key_custody'
        | 'envelope_digest_mismatch' }>
    | Readonly<{ kind: 'unsupported'; reason: 'unsupported_provider' | 'unsupported_protocol_key_custody' }>
    | Readonly<{ kind: 'simulated'; reason:
        | 'simulated_provider_evidence'
        | 'debug_provider_evidence'
        | 'synthetic_provider_evidence' }>
    | Readonly<{ kind: 'quarantined'; reason:
        | 'replayed_provider_evidence'
        | 'unavailable_provider_evidence'
        | 'revoked_provider_evidence' }>;

/**
* Concrete production adapter. No provider is qualified in phase 1, so every
* request remains unsupported until a reviewed trusted verifier replaces it.
*/
export async function verifyValueOperationEvidence(
    request: EvidenceVerificationRequest,
): Promise<EvidenceVerificationResult> {
    void request;
    return Object.freeze({ kind: 'unsupported', reason: 'unsupported_provider' });
}
