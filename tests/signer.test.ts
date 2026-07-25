import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import {
  deriveSovereignRoots,
  parseBip322Message,
  requestNonValueMessageSignature,
  signBip322Message,
  type NonValueMessageSignRequest,
} from '../services/signer';
import { signNonValueMessageNative } from '../services/enclave-storage';
import { workerManager } from '../services/worker-manager';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
  registerPlugin: vi.fn(),
}));
vi.mock('../services/enclave-storage', () => ({
  signNonValueMessageNative: vi.fn(),
  getWalletInfoNative: vi.fn(),
}));
vi.mock('../services/worker-manager', () => ({ workerManager: { derivePath: vi.fn() } }));

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function requestFor(type: 'message' | 'bip322', payload: unknown): NonValueMessageSignRequest {
  return {
    intentClass: 'non-value-message', type, layer: 'Mainnet',
    domain: type === 'bip322' ? 'conxius.wallet.bip322' : 'conxius.wallet.message',
    purpose: type === 'bip322' ? 'wallet-bip322' : 'wallet-message',
    payload, description: 'Non-value regression',
  };
}

describe('non-value signer boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  });

  const valueShapes = [
    { psbt: '70736274ff00' },
    { nested: { psbt: '70736274ff00' } },
    { rawTx: 'deadbeef' },
    { nested: { transaction: 'deadbeef' } },
    { valueArtifact: { kind: 'bitcoin-psbt' } },
    { valueEnvelope: { canonicalOperationDigest: '11'.repeat(32) } },
    { amount: 1, recipient: 'bc1qdestination' },
    { broadcast: { tx: 'deadbeef' } },
    { settlement: { status: 'pending' } },
  ];

  it.each(['message', 'bip322'] as const)('rejects every value-shaped %s payload before native or worker execution', async (type) => {
    for (const payload of valueShapes) {
      await expect(requestNonValueMessageSignature(requestFor(type, payload) as any, 'vault'))
        .rejects.toThrow(/message-compatible|Malformed|Value signing/);
    }
    expect(signNonValueMessageNative).not.toHaveBeenCalled();
    expect(workerManager.derivePath).not.toHaveBeenCalled();
  });

  it('preserves valid native login/message signing with an exact purpose and domain', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(signNonValueMessageNative).mockResolvedValue({ signature: 'aa', pubkey: '02'.repeat(33) });
    await expect(requestNonValueMessageSignature(
      requestFor('message', { message: 'sign in to example.test' }), 'identity-vault',
    )).resolves.toMatchObject({ signature: 'aa', pubkey: '02'.repeat(33) });
    expect(signNonValueMessageNative).toHaveBeenCalledWith({
      intentClass: 'non-value-message', purpose: 'wallet-message', domain: 'conxius.wallet.message',
      vault: 'identity-vault', messageHash: expect.stringMatching(/^[0-9a-f]{64}$/), network: 'mainnet',
    });
    expect(workerManager.derivePath).not.toHaveBeenCalled();
  });

  it('preserves the valid web Nostr evaluation path', async () => {
    vi.mocked(workerManager.derivePath).mockResolvedValue({
      publicKey: new Uint8Array(33).fill(2), privateKey: undefined, chainCode: new Uint8Array(32),
    } as any);
    const result = await requestNonValueMessageSignature({
      intentClass: 'non-value-message', type: 'message', layer: 'Nostr',
      domain: 'conxius.nostr.evaluation', purpose: 'nostr-evaluation',
      payload: { message: 'evaluation event' }, description: 'Nostr evaluation',
    }, new Uint8Array(64));
    expect(result.pubkey).toHaveLength(66);
    expect(workerManager.derivePath).toHaveBeenCalledOnce();
  });
});

describe('signer utilities', () => {
  it('derives sovereign roots and routes BIP-322 through the non-value boundary', async () => {
    await expect(deriveSovereignRoots(TEST_MNEMONIC)).resolves.toMatchObject({ btc: expect.stringMatching(/^bc1/) });
    vi.mocked(workerManager.derivePath).mockResolvedValue({
      publicKey: new Uint8Array(33).fill(2), privateKey: undefined, chainCode: new Uint8Array(32),
    } as any);
    await expect(signBip322Message('login challenge', new Uint8Array(64))).resolves.toBe('');
  });

  it('parses anchored login messages only', () => {
    expect(parseBip322Message('example.test wants you to sign in with your Conxius Identity:\naddr\nNonce: abc').isLogin).toBe(true);
    expect(parseBip322Message('prefix\nexample.test wants you to sign in with your Conxius Identity:').isLogin).toBe(false);
  });
});
