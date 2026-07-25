import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import type { EvidenceVerificationRequest, EvidenceVerificationResult } from '../services/value-operation-gate';

const mocks = vi.hoisted(() => ({
    verifier: undefined as undefined | ((request: EvidenceVerificationRequest) => Promise<EvidenceVerificationResult>),
    getPublicKeyNative: vi.fn(),
    signBatchNative: vi.fn(),
    getPsbtSighashes: vi.fn(),
    getUnsignedTxHex: vi.fn(),
    finalizePsbtWithSigs: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('../services/value-operation-evidence-verifier', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/value-operation-evidence-verifier')>();
    return {
        ...actual,
        verifyValueOperationEvidence: (request: EvidenceVerificationRequest) => mocks.verifier!(request),
    };
});
vi.mock('../services/enclave-storage', () => ({
    getPublicKeyNative: mocks.getPublicKeyNative,
    signBatchNative: mocks.signBatchNative,
}));
vi.mock('../services/psbt', () => ({
    getPsbtSighashes: mocks.getPsbtSighashes,
    getUnsignedTxHex: mocks.getUnsignedTxHex,
    finalizePsbtWithSigs: mocks.finalizePsbtWithSigs,
}));

import {
    createValueOperationEnvelope,
    digestValueOperationEnvelope,
} from '../services/value-operation-gate';
import {
    createBitcoinPsbtOperationPayload,
    createDeterministicValueOperationIntent,
    prepareValueOperationAuthorization,
    requestValueOperationAuthorization,
} from '../services/value-operations';
import { signAuthorizedValueOperationNative } from '../services/value-signer';

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

describe('authorized PSBT artifact binding', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.verifier = async (request) => verifiedBinding(request);
        mocks.getPublicKeyNative.mockResolvedValue({ pubkey: `02${'11'.repeat(32)}` });
        mocks.getPsbtSighashes.mockReturnValue([{ hash: Buffer.alloc(32), index: 0 }]);
        mocks.getUnsignedTxHex.mockReturnValue('00');
        mocks.signBatchNative.mockResolvedValue({ signatures: [{ signature: '22'.repeat(64) }] });
        mocks.finalizePsbtWithSigs.mockReturnValue('deadbeef');
    });

    it('rejects swapping PSBT B beside a genuine authorization for PSBT A without native calls or stage consumption', async () => {
        const psbtA = '70736274ff00aa';
        const psbtB = '70736274ff00bb';
        const request = prepareValueOperationAuthorization({
            intent: createDeterministicValueOperationIntent({
                operationType: 'bitcoin-transfer',
                chain: 'bitcoin',
                layer: 'l1',
                payload: createBitcoinPsbtOperationPayload(psbtA),
                network: 'testnet',
                purpose: 'artifact-binding-test',
                domain: 'conxius.wallet',
                audience: 'native-value-signer',
            }),
            summary: {
                title: 'Authorize transfer', action: 'Send Bitcoin', amount: '1 sat',
                network: 'testnet', purpose: 'Test',
            },
            custody: {
                boundary: 'wallet-native-enclave', protocolKeyIdentity: 'bitcoin-account-0', algorithm: 'secp256k1-ecdsa',
            },
            evidence: { opaqueEvidence: { test: 'verified' } },
        });
        const authorization = await requestValueOperationAuthorization(request, 'confirmed');
        expect(authorization.kind).toBe('authorized');
        if (authorization.kind !== 'authorized') throw new Error('Expected test authorization.');

        await expect(signAuthorizedValueOperationNative({
            authorization, psbt: psbtB, network: 'testnet', vault: 'test-vault',
        })).resolves.toEqual({ kind: 'rejected', reason: 'mismatched_authorization' });
        expect(mocks.getPublicKeyNative).not.toHaveBeenCalled();
        expect(mocks.signBatchNative).not.toHaveBeenCalled();

        await expect(signAuthorizedValueOperationNative({
            authorization, psbt: psbtA, network: 'testnet', vault: 'test-vault',
        })).resolves.toMatchObject({ kind: 'signed' });
        expect(mocks.signBatchNative).toHaveBeenCalledOnce();
    });
});
