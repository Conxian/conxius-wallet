import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvidenceVerificationRequest, EvidenceVerificationResult } from '../services/value-operation-gate';

const mocks = vi.hoisted(() => ({
    verifier: undefined as undefined | ((request: EvidenceVerificationRequest) => Promise<EvidenceVerificationResult>),
    getPublicKeyNative: vi.fn(),
    signBatchNative: vi.fn(),
    getPsbtSighashes: vi.fn(),
    getUnsignedTxHex: vi.fn(),
    finalizePsbtWithSigs: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => true },
    registerPlugin: vi.fn(() => ({ signBatch: mocks.signBatchNative })),
}));
vi.mock('../services/value-operation-evidence-verifier', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/value-operation-evidence-verifier')>();
    return {
        ...actual,
        verifyValueOperationEvidence: (request: EvidenceVerificationRequest) => mocks.verifier!(request),
    };
});
vi.mock('../services/enclave-storage', () => ({ getPublicKeyNative: mocks.getPublicKeyNative }));
vi.mock('../services/psbt', () => ({
    getPsbtSighashes: mocks.getPsbtSighashes,
    getUnsignedTxHex: mocks.getUnsignedTxHex,
    finalizePsbtWithSigs: mocks.finalizePsbtWithSigs,
}));

import { broadcastAuthorizedBitcoinTransaction } from '../services/bitcoin-broadcast';
import { createValueOperationEnvelope, digestValueOperationEnvelope } from '../services/value-operation-gate';
import {
    consumeAuthorizedValueOperationStage,
    createBitcoinPsbtOperationPayload,
    createDeterministicValueOperationIntent,
    prepareValueOperationAuthorization,
    requestValueOperationAuthorization,
} from '../services/value-operations';
import { signAuthorizedValueOperationNative } from '../services/value-signer';

const VALID_UNSIGNED_TX = '020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff010000000000000000016a00000000';

function verifiedBinding(request: EvidenceVerificationRequest): EvidenceVerificationResult {
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
        providerDigest: '11'.repeat(32),
        evidenceDigest: '22'.repeat(32),
    });
    return {
        kind: 'verified',
        resultClass: 'authoritative',
        providerStatus: 'verified',
        evidenceStatus: 'verified',
        providerDigest: '11'.repeat(32),
        evidenceDigest: '22'.repeat(32),
        boundEnvelopeDigest: digestValueOperationEnvelope(envelope),
        localAuthorizationExpiresAtMs: Date.now() + 10_000,
    };
}

async function authorizeAndSign(psbt: string, finalizedTransactionHex: string) {
    const prepared = prepareValueOperationAuthorization({
        intent: createDeterministicValueOperationIntent({
            operationType: 'bitcoin-transfer',
            chain: 'bitcoin',
            layer: 'l1',
            payload: createBitcoinPsbtOperationPayload(psbt),
            network: 'testnet',
            purpose: `broadcast-binding-${psbt}`,
            domain: 'conxius.wallet',
            audience: 'native-value-signer',
        }),
        summary: { title: 'Authorize transfer', action: 'Send Bitcoin', network: 'testnet', purpose: 'Test' },
        custody: {
            boundary: 'wallet-native-enclave',
            protocolKeyIdentity: 'bitcoin-account-0',
            algorithm: 'secp256k1-ecdsa',
        },
        evidence: { opaqueEvidence: { test: 'verified' } },
    });
    const authorization = await requestValueOperationAuthorization(prepared, 'confirmed');
    if (authorization.kind !== 'authorized') throw new Error('Expected test authorization.');
    mocks.finalizePsbtWithSigs.mockReturnValueOnce(finalizedTransactionHex);
    const signed = await signAuthorizedValueOperationNative({
        authorization,
        psbt,
        network: 'testnet',
        vault: 'test-vault',
    });
    if (signed.kind !== 'signed') throw new Error('Expected signer-issued artifact.');
    return { authorization, signed };
}

describe('wallet-owned Bitcoin broadcast containment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.verifier = async (request) => verifiedBinding(request);
        mocks.getPublicKeyNative.mockResolvedValue({ pubkey: `02${'11'.repeat(32)}` });
        mocks.getPsbtSighashes.mockReturnValue([{ hash: Buffer.alloc(32), index: 0 }]);
        mocks.getUnsignedTxHex.mockReturnValue(VALID_UNSIGNED_TX);
        mocks.signBatchNative.mockResolvedValue({ signatures: [{ signature: '22'.repeat(64) }] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('rejects a missing authorization before any provider seam', async () => {
        const { signed } = await authorizeAndSign('70736274ff0001', 'deadbeef');
        await expect(broadcastAuthorizedBitcoinTransaction({
            artifact: signed.broadcastArtifact,
        } as never)).resolves.toEqual({ kind: 'rejected', reason: 'invalid_broadcast_request' });
    });

    it('rejects a structurally identical caller-created lookalike', async () => {
        const { authorization, signed } = await authorizeAndSign('70736274ff0002', 'deadbeef');
        const forged = { ...signed.broadcastArtifact };
        await expect(broadcastAuthorizedBitcoinTransaction({
            authorization,
            artifact: forged,
        })).resolves.toEqual({ kind: 'rejected', reason: 'forged_broadcast_artifact' });
    });

    it('rejects cross-authorization pairing', async () => {
        const first = await authorizeAndSign('70736274ff0003', 'deadbeef');
        const second = await authorizeAndSign('70736274ff0004', 'cafebabe');
        await expect(broadcastAuthorizedBitcoinTransaction({
            authorization: second.authorization,
            artifact: first.signed.broadcastArtifact,
        })).resolves.toEqual({ kind: 'rejected', reason: 'mismatched_authorization' });
    });

    it('rejects a substituted transaction even when copied beside genuine digests', async () => {
        const { authorization, signed } = await authorizeAndSign('70736274ff0005', 'deadbeef');
        expect(Object.isFrozen(signed.broadcastArtifact)).toBe(true);
        const substituted = { ...signed.broadcastArtifact, transactionHex: 'cafebabe' };
        await expect(broadcastAuthorizedBitcoinTransaction({
            authorization,
            artifact: substituted,
        })).resolves.toEqual({ kind: 'rejected', reason: 'forged_broadcast_artifact' });
    });

    it('rejects a genuine signer artifact after authorization expiry without provider I/O or stage consumption', async () => {
        vi.useFakeTimers();
        const authorizedAtMs = Date.UTC(2026, 6, 25, 12, 0, 0);
        vi.setSystemTime(authorizedAtMs);
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const { authorization, signed } = await authorizeAndSign('70736274ff0006', 'deadbeef');

        vi.setSystemTime(authorizedAtMs + 10_001);
        await expect(broadcastAuthorizedBitcoinTransaction({
            authorization,
            artifact: signed.broadcastArtifact,
        })).resolves.toEqual({ kind: 'rejected', reason: 'expired_authorization' });
        expect(fetchSpy).not.toHaveBeenCalled();

        vi.setSystemTime(authorizedAtMs + 9_999);
        expect(consumeAuthorizedValueOperationStage(
            authorization,
            'broadcast',
            authorization.envelopeDigest,
        )).toEqual({
            kind: 'consumed',
            stage: 'broadcast',
            envelopeDigest: authorization.envelopeDigest,
        });
        fetchSpy.mockRestore();
    });

    it('keeps a genuine lineage unsupported without provider I/O or broadcast-stage consumption', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const { authorization, signed } = await authorizeAndSign('70736274ff0007', 'DEADBEEF');

        expect(signed.broadcastArtifact).toMatchObject({
            kind: 'signer-issued-bitcoin-broadcast',
            transactionHex: 'deadbeef',
            envelopeDigest: authorization.envelopeDigest,
            sourceOperationDigest: authorization.envelope.canonicalOperationDigest,
        });
        expect(signed.broadcastArtifact.finalizedTransactionDigest)
            .not.toBe(signed.broadcastArtifact.sourceOperationDigest);
        expect(signed.broadcastArtifact.authorizedTransitionDigest)
            .not.toBe(signed.broadcastArtifact.finalizedTransactionDigest);
        await expect(broadcastAuthorizedBitcoinTransaction({
            authorization,
            artifact: signed.broadcastArtifact,
        })).resolves.toEqual({ kind: 'unsupported', reason: 'qualified_provider_unavailable' });
        await expect(broadcastAuthorizedBitcoinTransaction({
            authorization,
            artifact: signed.broadcastArtifact,
        })).resolves.toEqual({ kind: 'unsupported', reason: 'qualified_provider_unavailable' });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(consumeAuthorizedValueOperationStage(
            authorization,
            'broadcast',
            authorization.envelopeDigest,
        )).toEqual({
            kind: 'consumed',
            stage: 'broadcast',
            envelopeDigest: authorization.envelopeDigest,
        });
        fetchSpy.mockRestore();
    });
});
