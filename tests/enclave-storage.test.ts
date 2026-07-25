import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ native: vi.fn(), isAvailable: vi.fn(), signTransaction: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native },
  registerPlugin: vi.fn(() => ({ isAvailable: mocks.isAvailable, signTransaction: mocks.signTransaction })),
}));

import * as enclave from '../services/enclave-storage';

describe('enclave storage public boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.native.mockReturnValue(true);
    mocks.isAvailable.mockResolvedValue({ available: true });
    mocks.signTransaction.mockResolvedValue({ signature: 'aa', pubkey: '02'.repeat(33) });
  });

  it('does not export the raw plugin or arbitrary native signers', () => {
    expect(enclave).not.toHaveProperty('SecureEnclave');
    expect(enclave).not.toHaveProperty('signNative');
    expect(enclave).not.toHaveProperty('signBatchNative');
  });

  it('allows an exact domain-separated non-value message request', async () => {
    await expect(enclave.signNonValueMessageNative({
      intentClass: 'non-value-message', purpose: 'identity-login', domain: 'conxius.identity.login',
      vault: 'vault', messageHash: '11'.repeat(32), network: 'mainnet',
    })).resolves.toMatchObject({ signature: 'aa' });
    expect(mocks.signTransaction).toHaveBeenCalledOnce();
  });

  it.each([
    { psbt: '70736274ff00' }, { rawTx: 'deadbeef' }, { transaction: 'deadbeef' },
    { amount: 1, recipient: 'bc1q' }, { broadcast: true },
  ])('rejects unauthorized raw native signing input %# before the plugin', async (extra) => {
    await expect(enclave.signNonValueMessageNative({
      intentClass: 'non-value-message', purpose: 'identity-login', domain: 'conxius.identity.login',
      vault: 'vault', messageHash: '11'.repeat(32), ...extra,
    } as any)).rejects.toThrow(/not allowed|Malformed/);
    expect(mocks.signTransaction).not.toHaveBeenCalled();
  });

  it('rejects a mismatched domain and purpose before the plugin', async () => {
    await expect(enclave.signNonValueMessageNative({
      intentClass: 'non-value-message', purpose: 'web5-identity', domain: 'conxius.identity.login',
      vault: 'vault', messageHash: '11'.repeat(32),
    } as any)).rejects.toThrow('domain does not match');
    expect(mocks.signTransaction).not.toHaveBeenCalled();
  });
});
