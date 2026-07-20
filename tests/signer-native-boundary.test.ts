import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import { requestEnclaveSignature, SignRequest } from '../services/signer';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  isAvailable: vi.fn(),
  signTransaction: vi.fn(),
  signBatch: vi.fn(),
  derivePath: vi.fn(),
  getPsbtSighashes: vi.fn(),
  getUnsignedTxHex: vi.fn(),
  finalizePsbtWithSigs: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
  },
  registerPlugin: vi.fn(() => ({
    isAvailable: mocks.isAvailable,
    signTransaction: mocks.signTransaction,
    signBatch: mocks.signBatch,
  })),
}));

vi.mock('../services/worker-manager', () => ({
  workerManager: {
    derivePath: mocks.derivePath,
  },
}));

vi.mock('../services/psbt', () => ({
  getPsbtSighashes: mocks.getPsbtSighashes,
  getUnsignedTxHex: mocks.getUnsignedTxHex,
  finalizePsbtWithSigs: mocks.finalizePsbtWithSigs,
}));

describe('native signer security boundary', () => {
  const nativePubkey = '02'.repeat(33);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isAvailable.mockResolvedValue({ available: true });
    mocks.signTransaction.mockResolvedValue({ signature: 'native-signature', pubkey: nativePubkey });
    mocks.signBatch.mockResolvedValue({ signatures: [{ signature: 'native-batch-signature', pubkey: nativePubkey }] });
    mocks.getPsbtSighashes.mockReturnValue([{ hash: Buffer.alloc(32), index: 0 }]);
    mocks.getUnsignedTxHex.mockReturnValue('unsigned-transaction');
  });

  const messageRequest: SignRequest = {
    type: 'message',
    layer: 'Mainnet',
    payload: { hash: '00'.repeat(32) },
    description: 'Native boundary regression',
  };

  it('rejects when the native enclave reports unavailable without invoking the worker', async () => {
    mocks.isAvailable.mockResolvedValueOnce({ available: false });

    await expect(requestEnclaveSignature(messageRequest, 'vault-id')).rejects.toThrow('Native Enclave not available');

    expect(mocks.signTransaction).not.toHaveBeenCalled();
    expect(mocks.signBatch).not.toHaveBeenCalled();
    expect(mocks.derivePath).not.toHaveBeenCalled();
  });

  it('rejects when the native plugin availability probe fails without invoking the worker', async () => {
    mocks.isAvailable.mockRejectedValueOnce(new Error('Plugin unavailable'));

    await expect(requestEnclaveSignature(messageRequest, 'vault-id')).rejects.toThrow('Native Enclave not available');

    expect(mocks.signTransaction).not.toHaveBeenCalled();
    expect(mocks.derivePath).not.toHaveBeenCalled();
  });

  it('propagates a native plugin signing rejection without invoking the worker', async () => {
    mocks.signTransaction.mockRejectedValueOnce(new Error('Native signing rejected'));

    await expect(requestEnclaveSignature(messageRequest, 'vault-id')).rejects.toThrow('Native signing rejected');

    expect(mocks.signTransaction).toHaveBeenCalledOnce();
    expect(mocks.derivePath).not.toHaveBeenCalled();
  });

  it('fails closed when native batch signing rejects without finalizing or using the worker', async () => {
    mocks.signBatch.mockRejectedValueOnce(new Error('Native batch signing failed'));
    const batchRequest: SignRequest = {
      type: 'psbt',
      layer: 'Mainnet',
      payload: { psbt: 'unsigned-psbt' },
      description: 'Native batch boundary regression',
    };

    await expect(requestEnclaveSignature(batchRequest, 'vault-id')).rejects.toThrow('Native batch signing failed');

    expect(mocks.signTransaction).toHaveBeenCalledOnce();
    expect(mocks.signBatch).toHaveBeenCalledOnce();
    expect(mocks.finalizePsbtWithSigs).not.toHaveBeenCalled();
    expect(mocks.derivePath).not.toHaveBeenCalled();
  });
});
