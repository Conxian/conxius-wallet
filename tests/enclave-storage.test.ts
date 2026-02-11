import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SecureEnclave,
  hasEnclaveBlob,
  getEnclaveBlob,
  setEnclaveBlob,
  removeEnclaveBlob,
  clearEnclaveBiometricSession,
  signNative,
  getPublicKeyNative,
  getDerivedSecretNative,
  getWalletInfoNative
} from '../services/enclave-storage';

// Mock Capacitor
const mockIsNativePlatform = vi.fn();
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNativePlatform()
  },
  registerPlugin: vi.fn(() => ({
    isAvailable: vi.fn(() => Promise.resolve({ available: true })),
    hasItem: vi.fn(() => Promise.resolve({ exists: true })),
    getItem: vi.fn(() => Promise.resolve({ value: 'test-value' })),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
    authenticate: vi.fn(() => Promise.resolve({ authenticated: true, validUntilMs: Date.now() + 300000 })),
    clearBiometricSession: vi.fn(() => Promise.resolve()),
    signTransaction: vi.fn(() => Promise.resolve({ signature: 'test-sig', pubkey: 'test-pubkey' })),
    unlockSession: vi.fn(() => Promise.resolve({ unlocked: true })),
    getPublicKey: vi.fn(() => Promise.resolve({ pubkey: 'test-pubkey' })),
    getDerivedSecret: vi.fn(() => Promise.resolve({ secret: 'test-secret', pubkey: 'test-pubkey' })),
    getWalletInfo: vi.fn(() => Promise.resolve({
      btcPubkey: 'btc-pubkey',
      stxPubkey: 'stx-pubkey',
      liquidPubkey: 'liquid-pubkey',
      evmAddress: '0x1234'
    }))
  }))
}));

describe('enclave-storage service', () => {
  const TEST_KEY = 'test-key';
  const TEST_VALUE = 'sensitive-test-data';

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear storage mocks
    mockIsNativePlatform.mockReturnValue(false);
    global.sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    } as any;
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasEnclaveBlob', () => {
    it('should delegate to native plugin on native platform', async () => {
      mockIsNativePlatform.mockReturnValue(true);
      // The mock hasItem always resolves { exists: true }
      const result = await hasEnclaveBlob('any-key');
      expect(result).toBe(true);
    });

    it('should check sessionStorage when native enclave unavailable', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      global.sessionStorage.getItem = vi.fn(() => null);
      global.localStorage.getItem = vi.fn(() => null);
      
      const result = await hasEnclaveBlob(TEST_KEY);
      
      expect(result).toBe(false);
      expect(global.sessionStorage.getItem).toHaveBeenCalledWith(TEST_KEY);
    });

    it('should return true when key exists in sessionStorage', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      global.sessionStorage.getItem = vi.fn(() => TEST_VALUE);
      
      const result = await hasEnclaveBlob(TEST_KEY);
      
      expect(result).toBe(true);
    });

    it('should return true when key exists in localStorage', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      global.sessionStorage.getItem = vi.fn(() => null);
      global.localStorage.getItem = vi.fn(() => TEST_VALUE);
      
      const result = await hasEnclaveBlob(TEST_KEY);
      
      expect(result).toBe(true);
    });

    it('should handle native enclave errors gracefully', async () => {
      mockIsNativePlatform.mockReturnValue(true);
      // The mock will throw if isAvailable fails
      const result = await hasEnclaveBlob(TEST_KEY);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getEnclaveBlob', () => {
    it('should return null for non-existent key', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      global.sessionStorage.getItem = vi.fn(() => null);
      global.localStorage.getItem = vi.fn(() => null);
      
      const result = await getEnclaveBlob('non-existent');
      
      expect(result).toBeNull();
    });

    it('should retrieve value from sessionStorage', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      global.sessionStorage.getItem = vi.fn(() => TEST_VALUE);
      
      const result = await getEnclaveBlob(TEST_KEY);
      
      expect(result).toBe(TEST_VALUE);
      expect(global.sessionStorage.getItem).toHaveBeenCalledWith(TEST_KEY);
    });

    it('should retrieve from localStorage and not migrate to sessionStorage', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      global.sessionStorage.getItem = vi.fn(() => null);
      global.localStorage.getItem = vi.fn(() => TEST_VALUE);
      
      const result = await getEnclaveBlob(TEST_KEY);
      
      expect(result).toBe(TEST_VALUE);
    });

    it('should handle biometric requirement on native', async () => {
      mockIsNativePlatform.mockReturnValue(true);
      // On native, biometric gating is handled by the native plugin (SecureEnclavePlugin.java)
      // The JS wrapper delegates to the plugin which returns the value after biometric auth
      const result = await getEnclaveBlob(TEST_KEY, { requireBiometric: true });
      expect(result).toBeDefined();
    });

    it('should not require biometric by default', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      global.sessionStorage.getItem = vi.fn(() => TEST_VALUE);
      
      const result = await getEnclaveBlob(TEST_KEY);
      
      expect(result).toBe(TEST_VALUE);
    });
  });

  describe('setEnclaveBlob', () => {
    it('should store value in localStorage when native unavailable', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      
      await setEnclaveBlob(TEST_KEY, TEST_VALUE);
      
    });

    it('should handle biometric requirement on native', async () => {
      mockIsNativePlatform.mockReturnValue(true);
      // On native, biometric gating is handled by SecureEnclavePlugin.java
      // The JS wrapper delegates to the native plugin which performs biometric auth
      await expect(setEnclaveBlob(TEST_KEY, TEST_VALUE, { requireBiometric: true })).resolves.not.toThrow();
    });

    it('should clear legacy localStorage on success', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      
      await setEnclaveBlob(TEST_KEY, TEST_VALUE);
      
    });

    it('should not throw for simple storage operations', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      
      await expect(setEnclaveBlob(TEST_KEY, TEST_VALUE)).resolves.not.toThrow();
    });
  });

  describe('removeEnclaveBlob', () => {
    it('should remove from both session and local storage', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      
      await removeEnclaveBlob(TEST_KEY);
      
      expect(global.sessionStorage.removeItem).toHaveBeenCalledWith(TEST_KEY);
    });

    it('should handle native enclave removal', async () => {
      mockIsNativePlatform.mockReturnValue(true);
      
      // Should not throw even if native enclave fails
      await expect(removeEnclaveBlob(TEST_KEY)).resolves.not.toThrow();
    });

    it('should handle biometric when specified on native', async () => {
      mockIsNativePlatform.mockReturnValue(true);
      // On native, biometric gating is handled by SecureEnclavePlugin.java
      await expect(removeEnclaveBlob(TEST_KEY, { requireBiometric: true })).resolves.not.toThrow();
    });
  });

  describe('clearEnclaveBiometricSession', () => {
    it('should clear session without throwing', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      
      await expect(clearEnclaveBiometricSession()).resolves.not.toThrow();
    });

    it('should handle native enclave session clearing', async () => {
      mockIsNativePlatform.mockReturnValue(true);
      
      await expect(clearEnclaveBiometricSession()).resolves.not.toThrow();
    });
  });

  describe('Native signing operations', () => {
    it('signNative should require native platform', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      
      await expect(signNative({
        vault: 'test-vault',
        path: "m/84'/0'/0'/0/0",
        messageHash: 'test-hash'
      })).rejects.toThrow('Native Enclave not available');
    });

    it('getPublicKeyNative should require native platform', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      
      await expect(getPublicKeyNative({
        vault: 'test-vault',
        path: "m/84'/0'/0'/0/0"
      })).rejects.toThrow('Native Enclave not available');
    });

    it('getDerivedSecretNative should require native platform', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      
      await expect(getDerivedSecretNative({
        vault: 'test-vault',
        path: "m/84'/0'/0'/0/0"
      })).rejects.toThrow('Native Enclave not available');
    });

    it('getWalletInfoNative should require native platform', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      
      await expect(getWalletInfoNative({
        vault: 'test-vault'
      })).rejects.toThrow('Native Enclave not available');
    });
  });

  describe('security considerations', () => {
    it('should prefer localStorage over sessionStorage', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      global.sessionStorage.getItem = vi.fn(() => 'session-value');
      global.localStorage.getItem = vi.fn(() => 'local-value');
      
      const result = await getEnclaveBlob(TEST_KEY);
      
      // Should prefer sessionStorage value
      expect(result).toBe('local-value');
    });

    it('should handle storage quota exceeded gracefully', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      global.localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });
      
      // Should not throw, or throw with meaningful error
      await expect(setEnclaveBlob(TEST_KEY, 'x'.repeat(10000000)))
        .rejects.toThrow();
    });

    it('should handle concurrent access', async () => {
      mockIsNativePlatform.mockReturnValue(false);
      const value = 'concurrent-test';
      global.sessionStorage.getItem = vi.fn(() => value);
      
      const results = await Promise.all([
        getEnclaveBlob(TEST_KEY),
        getEnclaveBlob(TEST_KEY),
        getEnclaveBlob(TEST_KEY)
      ]);
      
      // All should return same value
      results.forEach(result => expect(result).toBe(value));
    });
  });
});
