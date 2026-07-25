import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import { signAuthorizedValueOperationNative } from '../services/value-signer';
import { digestBitcoinPsbtOperation, type AuthorizedValueOperation } from '../services/value-operations';
import { createValueOperationEnvelope, digestValueOperationEnvelope } from '../services/value-operation-gate';

const mocks = vi.hoisted(() => ({
    native: vi.fn(),
    getPublicKeyNative: vi.fn(),
    signBatchNative: vi.fn(),
    getPsbtSighashes: vi.fn(),
    getUnsignedTxHex: vi.fn(),
    finalizePsbtWithSigs: vi.fn(),
    consumeStage: vi.fn(),
    workerDerive: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: mocks.native },
    registerPlugin: vi.fn(() => ({ signBatch: mocks.signBatchNative })),
}));
vi.mock('../services/enclave-storage', () => ({
    getPublicKeyNative: mocks.getPublicKeyNative,
}));
vi.mock('../services/psbt', () => ({
    getPsbtSighashes: mocks.getPsbtSighashes,
    getUnsignedTxHex: mocks.getUnsignedTxHex,
    finalizePsbtWithSigs: mocks.finalizePsbtWithSigs,
}));
vi.mock('../services/value-operations', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/value-operations')>();
    return { ...actual, consumeAuthorizedValueOperationStage: mocks.consumeStage };
});
vi.mock('../services/worker-manager', () => ({ workerManager: { derivePath: mocks.workerDerive } }));

const envelope = createValueOperationEnvelope({
    operationType: 'bitcoin-transfer', chain: 'bitcoin', layer: 'l1',
    canonicalOperationDigest: digestBitcoinPsbtOperation('psbt'), network: 'mainnet', purpose: 'test',
    domain: 'conxius.wallet', nonce: 'operation:test', challenge: 'confirm:test', audience: 'native-value-signer',
    protocolKeyIdentity: 'bitcoin-account-0', algorithm: 'secp256k1-ecdsa',
    providerStatus: 'verified', evidenceStatus: 'verified', providerDigest: '11'.repeat(32), evidenceDigest: '22'.repeat(32),
});
const envelopeDigest = digestValueOperationEnvelope(envelope);
const authorization = {
    kind: 'authorized',
    envelope,
    envelopeDigest,
    capability: { envelopeDigest },
} as unknown as AuthorizedValueOperation;

const request = {
    authorization,
    psbt: 'psbt',
    network: 'mainnet' as const,
    vault: 'conxius_vault',
};
const VALID_UNSIGNED_TX = '020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff010000000000000000016a00000000';

describe('native value signer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.native.mockReturnValue(true);
        mocks.getPublicKeyNative.mockResolvedValue({ pubkey: `02${'11'.repeat(32)}` });
        mocks.getPsbtSighashes.mockReturnValue([{ hash: Buffer.alloc(32), index: 0 }]);
        mocks.getUnsignedTxHex.mockReturnValue(VALID_UNSIGNED_TX);
        mocks.consumeStage.mockReturnValue({ kind: 'consumed', stage: 'sign', envelopeDigest: authorization.envelopeDigest });
        mocks.signBatchNative.mockResolvedValue({ signatures: [{ signature: '22'.repeat(64), pubkey: `02${'11'.repeat(32)}` }] });
        mocks.finalizePsbtWithSigs.mockReturnValue('deadbeef');
    });

    it('never invokes native or worker signing on web', async () => {
        mocks.native.mockReturnValue(false);
        await expect(signAuthorizedValueOperationNative(request)).resolves.toEqual({
            kind: 'unsupported', reason: 'non_native_platform',
        });
        expect(mocks.getPublicKeyNative).not.toHaveBeenCalled();
        expect(mocks.signBatchNative).not.toHaveBeenCalled();
        expect(mocks.workerDerive).not.toHaveBeenCalled();
    });

    it('consumes the exact sign stage immediately before native signing', async () => {
        await expect(signAuthorizedValueOperationNative(request)).resolves.toMatchObject({ kind: 'signed' });
        expect(mocks.consumeStage).toHaveBeenCalledWith(authorization, 'sign', authorization.envelopeDigest);
        expect(mocks.consumeStage.mock.invocationCallOrder[0]).toBeLessThan(mocks.signBatchNative.mock.invocationCallOrder[0]);
        expect(mocks.getUnsignedTxHex.mock.invocationCallOrder[0]).toBeLessThan(mocks.consumeStage.mock.invocationCallOrder[0]);
        expect(mocks.getPublicKeyNative.mock.invocationCallOrder[0]).toBeLessThan(mocks.consumeStage.mock.invocationCallOrder[0]);
        expect(mocks.workerDerive).not.toHaveBeenCalled();
    });

    it('does not call native signing when the capability is forged, mismatched, or already consumed', async () => {
        for (const reason of ['forged_authorization', 'mismatched_authorization', 'consumed_authorization'] as const) {
            mocks.consumeStage.mockReturnValueOnce({ kind: 'rejected', reason });
            await expect(signAuthorizedValueOperationNative(request)).resolves.toEqual({ kind: 'rejected', reason });
        }
        expect(mocks.signBatchNative).not.toHaveBeenCalled();
        expect(mocks.workerDerive).not.toHaveBeenCalled();
    });

    it('returns typed failure after native rejection without fallback', async () => {
        mocks.signBatchNative.mockRejectedValueOnce(new Error('rejected'));
        await expect(signAuthorizedValueOperationNative(request)).resolves.toEqual({
            kind: 'rejected', reason: 'native_signing_failed',
        });
        expect(mocks.workerDerive).not.toHaveBeenCalled();
    });
});
