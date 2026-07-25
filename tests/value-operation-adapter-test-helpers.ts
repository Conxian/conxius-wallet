import { expect, vi } from 'vitest';
import * as evidenceVerifier from '../services/value-operation-evidence-verifier';
import {
    createValueOperationEnvelope,
    digestValueOperationEnvelope,
    type AuthorizedValueOperation,
    type CanonicalValue,
    type EvidenceVerificationRequest,
    type EvidenceVerificationResult,
} from '../services/value-operation-gate';
import {
    createDeterministicValueOperationIntent,
    prepareValueOperationAuthorization,
    requestValueOperationAuthorization,
} from '../services/value-operations';

const adapterVerifierMock = vi.hoisted(() => ({
    implementation: undefined as undefined | ((request: EvidenceVerificationRequest) => Promise<EvidenceVerificationResult>),
}));

vi.mock('../services/value-operation-evidence-verifier', async (importOriginal) => {
    const actual = await importOriginal<typeof evidenceVerifier>();
    return {
        ...actual,
        verifyValueOperationEvidence: (request: EvidenceVerificationRequest) =>
            adapterVerifierMock.implementation?.(request) ?? actual.verifyValueOperationEvidence(request),
    };
});

const PROVIDER_DIGEST = '31'.repeat(32);
const EVIDENCE_DIGEST = '42'.repeat(32);

export function installQualifiedAdapterTestVerifier(): void {
    adapterVerifierMock.implementation = async (request) => {
        const envelope = createValueOperationEnvelope({
            operationType: request.intent.operationType,
            chain: request.intent.chain,
            layer: request.intent.layer,
            canonicalOperationDigest: request.canonicalOperationDigest,
            network: request.intent.network,
            purpose: request.intent.purpose,
            domain: request.intent.domain,
            nonce: request.intent.nonce,
            challenge: request.intent.challenge,
            audience: request.intent.audience,
            protocolKeyIdentity: request.custody.protocolKeyIdentity,
            algorithm: request.custody.algorithm,
            providerStatus: 'verified',
            evidenceStatus: 'verified',
            providerDigest: PROVIDER_DIGEST,
            evidenceDigest: EVIDENCE_DIGEST,
        });
        return {
            kind: 'verified',
            resultClass: 'authoritative',
            providerStatus: 'verified',
            evidenceStatus: 'verified',
            providerDigest: PROVIDER_DIGEST,
            evidenceDigest: EVIDENCE_DIGEST,
            boundEnvelopeDigest: digestValueOperationEnvelope(envelope),
            localAuthorizationExpiresAtMs: Date.now() + 60_000,
        };
    };
}

export async function authorizeAdapterArtifact(
    artifact: CanonicalValue,
    fields: Partial<{ operationType: string; chain: string; layer: string; network: string; purpose: string }> = {},
): Promise<AuthorizedValueOperation> {
    installQualifiedAdapterTestVerifier();
    const artifactMetadata = artifact as Partial<Record<'operation' | 'chain' | 'layer' | 'network', unknown>>;
    const intent = createDeterministicValueOperationIntent({
        operationType: fields.operationType ?? String(artifactMetadata.operation ?? 'transfer'),
        chain: fields.chain ?? String(artifactMetadata.chain ?? 'bitcoin'),
        layer: fields.layer ?? String(artifactMetadata.layer ?? 'protocol-adapter'),
        payload: artifact,
        network: fields.network ?? String(artifactMetadata.network ?? 'testnet'),
        purpose: fields.purpose ?? 'adapter-test',
        domain: 'conxius.wallet.tests',
        audience: 'known-unsupported-adapter',
    });
    const prepared = prepareValueOperationAuthorization({
        intent,
        summary: { title: 'Adapter test', action: intent.operationType, network: intent.network, purpose: intent.purpose },
        custody: { boundary: 'wallet-native-enclave', protocolKeyIdentity: 'test-key', algorithm: 'secp256k1-schnorr' },
        evidence: { opaqueEvidence: { fixture: 'qualified-adapter-test' } },
    });
    const outcome = await requestValueOperationAuthorization(prepared, 'confirmed');
    expect(outcome.kind).toBe('authorized');
    if (outcome.kind !== 'authorized') throw new Error(`Authorization failed: ${outcome.reason}`);
    return outcome;
}

export function forgedAuthorization(): AuthorizedValueOperation {
    return {
        kind: 'authorized',
        envelope: {} as AuthorizedValueOperation['envelope'],
        envelopeDigest: '00'.repeat(32),
        capability: { kind: 'value-operation-authorization', envelopeDigest: '00'.repeat(32), localExpiresAtMs: Date.now() + 60_000 },
    };
}
