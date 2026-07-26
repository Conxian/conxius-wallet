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
    return { ...actual, verifyValueOperationEvidence: (request: EvidenceVerificationRequest) => mocks.verifier!(request) };
});
vi.mock('../services/enclave-storage', () => ({ getPublicKeyNative: mocks.getPublicKeyNative }));
vi.mock('../services/psbt', () => ({
    getPsbtSighashes: mocks.getPsbtSighashes,
    getUnsignedTxHex: mocks.getUnsignedTxHex,
    finalizePsbtWithSigs: mocks.finalizePsbtWithSigs,
}));

import {
    createValueOperationEnvelope,
    createValueOperationGate,
    digestValueOperationEnvelope,
} from '../services/value-operation-gate';
import {
    consumeAuthorizedValueOperationStage,
    createBitcoinPsbtOperationPayload,
    createDeterministicValueOperationIntent,
    prepareValueOperationAuthorization,
    requestValueOperationAuthorization,
    type AuthorizedValueOperation,
} from '../services/value-operations';
import { signAuthorizedValueOperationNative, type SignedBitcoinValueOperation } from '../services/value-signer';
import { broadcastAuthorizedBitcoinTransaction } from '../services/bitcoin-broadcast';

const VALID_UNSIGNED_TX = '020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff010000000000000000016a00000000';
const CHANGED_UNSIGNED_TX = '020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff010100000000000000016a00000000';
const VALID_FINAL_TX = '02000000010000000000000000000000000000000000000000000000000000000000000000000000000151ffffffff010000000000000000016a00000000';

function verifiedBinding(request: EvidenceVerificationRequest, expiresAt = Date.now() + 60_000): EvidenceVerificationResult {
    const envelope = createValueOperationEnvelope({
        operationType: request.intent.operationType, chain: request.intent.chain, layer: request.intent.layer,
        canonicalOperationDigest: request.canonicalOperationDigest, network: request.intent.network,
        purpose: request.intent.purpose, domain: request.intent.domain, nonce: request.intent.nonce,
        challenge: request.intent.challenge, audience: request.intent.audience,
        protocolKeyIdentity: request.custody.protocolKeyIdentity, algorithm: request.custody.algorithm,
        providerStatus: 'verified', evidenceStatus: 'verified', providerDigest: '11'.repeat(32), evidenceDigest: '22'.repeat(32),
    });
    return {
        kind: 'verified', resultClass: 'authoritative', providerStatus: 'verified', evidenceStatus: 'verified',
        providerDigest: '11'.repeat(32), evidenceDigest: '22'.repeat(32),
        boundEnvelopeDigest: digestValueOperationEnvelope(envelope), localAuthorizationExpiresAtMs: expiresAt,
    };
}

function preparedPsbt(psbt: string) {
    return prepareValueOperationAuthorization({
        intent: createDeterministicValueOperationIntent({
            operationType: 'bitcoin-transfer', chain: 'bitcoin', layer: 'l1',
            payload: createBitcoinPsbtOperationPayload(psbt), network: 'testnet', purpose: `broadcast-${psbt}`,
            domain: 'conxius.wallet', audience: 'native-value-signer',
        }),
        summary: { title: 'Authorize', action: 'Send', network: 'testnet', purpose: 'Test' },
        custody: { boundary: 'wallet-native-enclave', protocolKeyIdentity: 'bitcoin-account-0', algorithm: 'secp256k1-ecdsa' },
        evidence: { opaqueEvidence: { test: 'verified' } },
    });
}

async function authorizePsbt(psbt: string): Promise<AuthorizedValueOperation> {
    const outcome = await requestValueOperationAuthorization(preparedPsbt(psbt), 'confirmed');
    if (outcome.kind !== 'authorized') throw new Error(`Expected authorization, received ${outcome.kind}.`);
    return outcome;
}

async function authorizePsbtFromIndependentGate(psbt: string): Promise<AuthorizedValueOperation> {
    const prepared = preparedPsbt(psbt);
    const outcome = await createValueOperationGate().authorize({
        intent: prepared.intent,
        confirmation: { status: 'confirmed', confirmationId: `test:${prepared.intentDigest}`, intentDigest: prepared.intentDigest },
        custody: prepared.custody,
        evidence: prepared.evidence,
    });
    if (outcome.kind !== 'authorized') throw new Error(`Expected independent authorization, received ${outcome.kind}.`);
    return outcome;
}

async function sign(psbt: string, authorization: AuthorizedValueOperation): Promise<SignedBitcoinValueOperation> {
    const outcome = await signAuthorizedValueOperationNative({ authorization, psbt, network: 'testnet', vault: 'test-vault' });
    if (outcome.kind !== 'signed') throw new Error(`Expected signed artifact, received ${outcome.kind}.`);
    return outcome.signed;
}

function expectBroadcastStillAvailable(authorization: AuthorizedValueOperation) {
    expect(consumeAuthorizedValueOperationStage(authorization, 'broadcast', authorization.envelopeDigest))
        .toMatchObject({ kind: 'consumed' });
}

describe('wallet-owned Bitcoin broadcast authorization lineage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mocks.verifier = async (request) => verifiedBinding(request);
        mocks.getPublicKeyNative.mockResolvedValue({ pubkey: `02${'11'.repeat(32)}` });
        mocks.getPsbtSighashes.mockReturnValue([{ hash: Buffer.alloc(32), index: 0 }]);
        mocks.getUnsignedTxHex.mockReturnValue(VALID_UNSIGNED_TX);
        mocks.signBatchNative.mockResolvedValue({ signatures: [{ signature: '22'.repeat(64) }] });
        mocks.finalizePsbtWithSigs.mockReturnValue(VALID_FINAL_TX);
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        expect(fetch).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it('consumes broadcast exactly once only after full validation and returns unsupported without I/O', async () => {
        const authorization = await authorizePsbt('70736274ff0011');
        const signed = await sign('70736274ff0011', authorization);
        await expect(broadcastAuthorizedBitcoinTransaction({ authorization, signed })).resolves.toEqual({
            kind: 'unsupported', reason: 'qualified_provider_unavailable',
        });
        await expect(broadcastAuthorizedBitcoinTransaction({ authorization, signed })).resolves.toEqual({
            kind: 'rejected', reason: 'consumed_authorization',
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects swapped or mutated final transactions and copied/lookalike artifacts without consuming', async () => {
        const authorization = await authorizePsbt('70736274ff0022');
        const signed = await sign('70736274ff0022', authorization);
        for (const forged of [
            { ...signed, transactionHex: CHANGED_UNSIGNED_TX },
            { ...signed, transactionDigest: 'aa'.repeat(32) },
            { ...signed, network: 'mainnet' as const },
            Object.freeze({ ...signed }),
        ]) {
            await expect(broadcastAuthorizedBitcoinTransaction({ authorization, signed: forged })).resolves.toMatchObject({
                kind: 'rejected', reason: 'unregistered_signed_artifact',
            });
        }
        expectBroadcastStillAvailable(authorization);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects authorization A with signed artifact B and preserves A broadcast capability', async () => {
        const authorizationA = await authorizePsbt('70736274ff0033');
        const authorizationB = await authorizePsbt('70736274ff0044');
        const signedB = await sign('70736274ff0044', authorizationB);
        await expect(broadcastAuthorizedBitcoinTransaction({ authorization: authorizationA, signed: signedB })).resolves.toEqual({
            kind: 'rejected', reason: 'mismatched_authorization',
        });
        expectBroadcastStillAvailable(authorizationA);
        expectBroadcastStillAvailable(authorizationB);
    });

    it('rejects copied, forged, and cross-gate authorizations without consuming the signer authorization', async () => {
        const authorization = await authorizePsbt('70736274ff0055');
        const signed = await sign('70736274ff0055', authorization);
        const copied = Object.freeze({ ...authorization });
        const forged = Object.freeze({ ...authorization, capability: Object.freeze({ ...authorization.capability }) });
        const crossGate = await authorizePsbtFromIndependentGate('70736274ff0055');
        for (const candidate of [copied, forged, crossGate]) {
            await expect(broadcastAuthorizedBitcoinTransaction({ authorization: candidate, signed })).resolves.toMatchObject({
                kind: 'rejected',
            });
        }
        expectBroadcastStillAvailable(authorization);
    });

    it('rejects stale authorization without consuming broadcast', async () => {
        const authorization = await authorizePsbt('70736274ff0066');
        const signed = await sign('70736274ff0066', authorization);
        vi.spyOn(Date, 'now').mockReturnValue(authorization.capability.localExpiresAtMs + 1);
        await expect(broadcastAuthorizedBitcoinTransaction({ authorization, signed })).resolves.toEqual({
            kind: 'rejected', reason: 'expired_authorization',
        });
        vi.restoreAllMocks();
        expectBroadcastStillAvailable(authorization);
    });

    it('rejects retained PSBT/unsigned-intent mismatch without consuming broadcast', async () => {
        const authorization = await authorizePsbt('70736274ff0077');
        const signed = await sign('70736274ff0077', authorization);
        mocks.getUnsignedTxHex.mockReturnValue(CHANGED_UNSIGNED_TX);
        await expect(broadcastAuthorizedBitcoinTransaction({ authorization, signed })).resolves.toEqual({
            kind: 'rejected', reason: 'psbt_digest_mismatch',
        });
        expectBroadcastStillAvailable(authorization);
    });

    it('rejects malformed legacy/final-hex-only requests with no stage consumption or I/O', async () => {
        const authorization = await authorizePsbt('70736274ff0088');
        await expect(broadcastAuthorizedBitcoinTransaction({
            authorization, transactionHex: VALID_FINAL_TX,
        } as never)).resolves.toEqual({ kind: 'rejected', reason: 'invalid_broadcast_request' });
        expectBroadcastStillAvailable(authorization);
        expect(fetch).not.toHaveBeenCalled();
    });
});
