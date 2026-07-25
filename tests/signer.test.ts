import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  deriveSovereignRoots, 
  parseBip322Message,
  SignRequest 
} from '../services/signer';
import { signAuthorizedValueOperation as requestEnclaveSignature } from '../services/app-private/value-operation-signer';
import { Capacitor } from '@capacitor/core';
import { signNativeValue } from '../services/app-private/native-value-signing';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({ registerPlugin: vi.fn(),
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    SecureEnclave: { isAvailable: vi.fn().mockResolvedValue({ available: true }) }
  }
}));

// Mock enclave-storage
vi.mock('../services/app-private/native-value-signing', () => ({
  signNativeValue: vi.fn(),
  signNativeValueBatch: vi.fn(),
}));

vi.mock('../services/app-private/native-psbt', () => ({
  getNativePsbtSighashes: vi.fn(),
  getNativeUnsignedTxHex: vi.fn(),
  finalizeNativePsbt: vi.fn(),
}));

describe('signer service', () => {
  const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const TEST_PASSPHRASE = 'test-passphrase';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(signNativeValue).mockRejectedValue(new Error('NATIVE_VALUE_SIGNER_REQUIRED'));
  });

  describe('deriveSovereignRoots', () => {
    it('should validate mnemonic format', async () => {
      await expect(deriveSovereignRoots('invalid mnemonic')).rejects.toThrow('Invalid Mnemonic Phrase');
    });

    it('should derive Bitcoin Native Segwit address (BIP-84)', async () => {
      const result = await deriveSovereignRoots(TEST_MNEMONIC);
      
      expect(result.btc).toBeDefined();
      expect(result.btc).toMatch(/^bc1/); // Native Segwit starts with bc1
      expect(result.derivationPath).toBe("m/84'/0'/0'/0/0");
    });

    it('should derive Bitcoin Taproot address (BIP-86)', async () => {
      const result = await deriveSovereignRoots(TEST_MNEMONIC);
      
      expect(result.taproot).toBeDefined();
      expect(result.taproot).toMatch(/^bc1p/); // Taproot starts with bc1p
    });

    it('should derive Stacks address (BIP-44)', async () => {
      const result = await deriveSovereignRoots(TEST_MNEMONIC);
      
      expect(result.stx).toBeDefined();
      expect(result.stx).toMatch(/^(SP|ST)/); // Stacks mainnet/testnet
    });

    it('should derive Rootstock/EVM address', async () => {
      const result = await deriveSovereignRoots(TEST_MNEMONIC);
      
      expect(result.rbtc).toBeDefined();
      expect(result.rbtc).toMatch(/^0x/);
      expect(result.eth).toBe(result.rbtc); // Same address for both
    });

    it('should derive Liquid public key', async () => {
      const result = await deriveSovereignRoots(TEST_MNEMONIC);
      
      expect(result.liquid).toBeDefined();
      expect(result.liquid).toMatch(/^(ex|lq|tex|tlq)1[a-z0-9]+$/); // 33 bytes hex = 66 chars
    });

    it('should support passphrase-protected mnemonics', async () => {
      const resultWithoutPassphrase = await deriveSovereignRoots(TEST_MNEMONIC);
      const resultWithPassphrase = await deriveSovereignRoots(TEST_MNEMONIC, TEST_PASSPHRASE);
      
      // Different passphrases should produce different addresses
      expect(resultWithoutPassphrase.btc).not.toBe(resultWithPassphrase.btc);
    });

    it('should handle invalid mnemonic gracefully', async () => {
      await expect(deriveSovereignRoots('not a valid mnemonic phrase')).rejects.toThrow();
    });

    it('should handle empty mnemonic', async () => {
      await expect(deriveSovereignRoots('')).rejects.toThrow();
    });
  });

  describe('parseBip322Message', () => {
    it('should identify a valid login message', () => {
      const domain = 'test.com';
      const nonce = 'challenge123';
      const timestamp = new Date().toISOString();
      const msg = `${domain} wants you to sign in with your Conxius Identity:\nbc1q...\n\nURI: did:pkh:...\nWeb5: N/A\nNonce: ${nonce}\nIssued At: ${timestamp}`;

      const parsed = parseBip322Message(msg);
      expect(parsed.isLogin).toBe(true);
      expect(parsed.domain).toBe(domain);
      expect(parsed.nonce).toBe(nonce);
      expect(parsed.timestamp).toBe(timestamp);
    });

    it('should reject spoofed messages with prepended content', () => {
      const msg = `ATTACKER CONTENT\n\ntest.com wants you to sign in with your Conxius Identity:\nbc1q...\nNonce: 123`;
      const parsed = parseBip322Message(msg);
      expect(parsed.isLogin).toBe(false);
    });

    it('should handle unstructured messages gracefully', () => {
      const msg = 'Just a random message';
      const parsed = parseBip322Message(msg);
      expect(parsed.isLogin).toBe(false);
      expect(parsed.domain).toBeUndefined();
    });

    it('should handle missing nonce/timestamp fields', () => {
      const msg = `test.com wants you to sign in with your Conxius Identity:\nbc1q...`;
      const parsed = parseBip322Message(msg);
      expect(parsed.isLogin).toBe(true);
      expect(parsed.domain).toBe('test.com');
      expect(parsed.nonce).toBeUndefined();
      expect(parsed.timestamp).toBeUndefined();
    });
  });

  describe('requestEnclaveSignature', () => {
    it('rejects native signing failures without falling back to the TypeScript worker', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(signNativeValue).mockRejectedValueOnce(new Error('Native signer unavailable'));

      const request: SignRequest = {
        type: 'message',
        layer: 'Mainnet',
        payload: { hash: '00'.repeat(32) },
        description: 'Fail-closed native signing test'
      };

      await expect(requestEnclaveSignature(request, 'vault-id')).rejects.toThrow('Native signer unavailable');
    });

    it('rejects non-native signing without accepting seed material', async () => {
      const request: SignRequest = {
        type: 'psbt',
        layer: 'Mainnet',
        payload: { test: 'data' },
        description: 'Test transaction'
      };

      await expect(requestEnclaveSignature(request, 'vault-id')).rejects.toThrow('NATIVE_VALUE_SIGNER_REQUIRED');
    });

    it('rejects Nostr signing on the web instead of deriving a software key', async () => {
      const request: SignRequest = {
        type: 'message',
        layer: 'Nostr', // Nostr doesn't require seed
        payload: { message: 'test' },
        description: 'Test nostr event'
      };

      await expect(requestEnclaveSignature(request, 'vault-id')).rejects.toThrow('NATIVE_VALUE_SIGNER_REQUIRED');
    });

    it('does not return a fabricated signature or pubkey on the web', async () => {
      const request: SignRequest = {
        type: 'message',
        layer: 'Nostr',
        payload: { message: 'test' },
        description: 'Test'
      };

      await expect(requestEnclaveSignature(request, 'vault-id')).rejects.toThrow('NATIVE_VALUE_SIGNER_REQUIRED');
    });
  });

  describe('security considerations', () => {
    it('should not log seed phrases', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      try {
        await deriveSovereignRoots('invalid mnemonic');
      } catch {
        // Expected to throw
      }
      
      // Error messages should not contain sensitive data
      const errorCalls = consoleSpy.mock.calls;
      const errorStrings = errorCalls.flat().join(' ');
      expect(errorStrings).not.toContain(TEST_MNEMONIC.split(' ')[0]);
      
      consoleSpy.mockRestore();
    });

    it('should derive consistent addresses for same mnemonic', async () => {
      const result1 = await deriveSovereignRoots(TEST_MNEMONIC);
      const result2 = await deriveSovereignRoots(TEST_MNEMONIC);
      
      expect(result1.btc).toBe(result2.btc);
      expect(result1.taproot).toBe(result2.taproot);
      expect(result1.stx).toBe(result2.stx);
      expect(result1.rbtc).toBe(result2.rbtc);
    });

    it('should produce different addresses for different mnemonics', async () => {
      const anotherMnemonic = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
      
      const result1 = await deriveSovereignRoots(TEST_MNEMONIC);
      const result2 = await deriveSovereignRoots(anotherMnemonic);
      
      expect(result1.btc).not.toBe(result2.btc);
      expect(result1.taproot).not.toBe(result2.taproot);
    });
  });
});

describe('Enclave Layer Signing (Native)', () => {
    it('should call signNative with correct network for RGB', async () => {
      const request: SignRequest = {
        type: 'psbt',
        layer: 'RGB',
        payload: { hash: '00'.repeat(32) },
        description: 'RGB Sign'
      };

      // Mock Capacitor to be native
      const { Capacitor } = await import('@capacitor/core');
      (Capacitor.isNativePlatform as any).mockReturnValue(true);
      (Capacitor as any).SecureEnclave = { isAvailable: vi.fn().mockResolvedValue({ available: true }), signTransaction: vi.fn().mockResolvedValue({ signature: 'sig', pubkey: 'pub' }) };

      vi.mocked(signNativeValue).mockResolvedValue({ signature: 'sig', pubkey: 'pub' });

      await requestEnclaveSignature(request, 'vault');

      expect(signNativeValue).toHaveBeenCalledWith(expect.objectContaining({
        network: 'rgb',
        path: "m/86'/0'/0'/0/0"
      }));
    });

    it('should call signNative with sequential path for StateChain', async () => {
      const request: SignRequest = {
        type: 'psbt',
        layer: 'StateChain',
        payload: { hash: '00'.repeat(32), index: 5 },
        description: 'StateChain Sign'
      };

      const { Capacitor } = await import('@capacitor/core');
      (Capacitor.isNativePlatform as any).mockReturnValue(true);
      vi.mocked(signNativeValue).mockResolvedValue({ signature: 'sig', pubkey: 'pub' });

      await requestEnclaveSignature(request, 'vault');

      expect(signNativeValue).toHaveBeenCalledWith(expect.objectContaining({
        network: 'statechain',
        path: "m/84'/0'/0'/2/5"
      }));
    });
});
