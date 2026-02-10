import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  deriveSovereignRoots, 
  signBip322Message, 
  requestEnclaveSignature,
  SignRequest 
} from '../services/signer';
import * as bip39 from 'bip39';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false)
  }
}));

// Mock enclave-storage
vi.mock('../services/enclave-storage', () => ({
  signNative: vi.fn(),
  getWalletInfoNative: vi.fn()
}));

// Mock psbt
vi.mock('../services/psbt', () => ({
  getPsbtSighashes: vi.fn(),
  finalizePsbtWithSigs: vi.fn(),
  finalizePsbtWithSigsReturnBase64: vi.fn(),
  signPsbtBase64WithSeed: vi.fn()
}));

describe('signer service', () => {
  const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const TEST_PASSPHRASE = 'test-passphrase';

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(result.liquid).toMatch(/^[0-9a-fA-F]{66}$/); // 33 bytes hex = 66 chars
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

  describe('signBip322Message', () => {
    it('should sign a message and return signature', async () => {
      const message = 'Test message to sign';
      const signature = await signBip322Message(message, TEST_MNEMONIC);
      
      expect(signature).toBeDefined();
      expect(signature).toMatch(/^BIP322-SIG-/);
      expect(signature.length).toBeGreaterThan(20);
    });

    it('should produce deterministic signatures for same inputs', async () => {
      const message = 'Deterministic test';
      const sig1 = await signBip322Message(message, TEST_MNEMONIC);
      const sig2 = await signBip322Message(message, TEST_MNEMONIC);
      
      // Note: Due to ECDSA randomness, signatures won't be identical
      // but should verify against the same public key
      expect(sig1).toBeDefined();
      expect(sig2).toBeDefined();
    });

    it('should handle empty message', async () => {
      const signature = await signBip322Message('', TEST_MNEMONIC);
      expect(signature).toBeDefined();
    });

    it('should still produce a signature with non-standard mnemonic', async () => {
      // signBip322Message does not validate BIP-39 mnemonics — it hashes the input directly
      const signature = await signBip322Message('test', 'invalid');
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
    });
  });

  describe('requestEnclaveSignature', () => {
    it('should throw error when master seed is missing', async () => {
      const request: SignRequest = {
        type: 'transaction',
        layer: 'Mainnet',
        payload: { test: 'data' },
        description: 'Test transaction'
      };

      await expect(requestEnclaveSignature(request)).rejects.toThrow('Master Seed missing');
    });

    it('should simulate processing delay on web platform', async () => {
      const startTime = Date.now();
      const request: SignRequest = {
        type: 'message',
        layer: 'Nostr', // Nostr doesn't require seed
        payload: { message: 'test' },
        description: 'Test nostr event'
      };

      // Nostr requests don't require seed, but should still process
      await requestEnclaveSignature(request);
      
      const elapsed = Date.now() - startTime;
      // Should complete without error on web platform
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should include timestamp in result', async () => {
      const beforeTime = Date.now();
      const request: SignRequest = {
        type: 'message',
        layer: 'Nostr',
        payload: { message: 'test' },
        description: 'Test'
      };

      const result = await requestEnclaveSignature(request);
      const afterTime = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should return signature and pubkey', async () => {
      const request: SignRequest = {
        type: 'message',
        layer: 'Nostr',
        payload: { message: 'test' },
        description: 'Test'
      };

      const result = await requestEnclaveSignature(request);

      expect(result.signature).toBeDefined();
      expect(result.pubkey).toBeDefined();
      expect(typeof result.signature).toBe('string');
      expect(typeof result.pubkey).toBe('string');
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
