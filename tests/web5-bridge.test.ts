import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnclaveKeyManager } from '../services/web5';

// Mock enclave-storage
vi.mock('../services/enclave-storage', () => ({
    getDerivedSecretNative: vi.fn().mockResolvedValue({ pubkey: '02' + 'a'.repeat(64) }),
    signNative: vi.fn().mockResolvedValue({ signature: 'b'.repeat(128) }),
    getEnclaveBlob: vi.fn().mockResolvedValue('test-vault')
}));

// Mock crypto.subtle for node environment if needed, but Vitest/JSDOM should handle it
if (typeof crypto === 'undefined') {
    (global as any).crypto = {
        subtle: {
            digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
        }
    };
}

describe('EnclaveKeyManager', () => {
    let km: EnclaveKeyManager;

    beforeEach(() => {
        km = new EnclaveKeyManager();
    });

    it('should get public key from enclave', async () => {
        const jwk = await km.getPublicKey({ keyAlias: 'test' });
        expect(jwk.kty).toBe('EC');
        expect(jwk.crv).toBe('secp256k1');
        expect(jwk.x).toBe('a'.repeat(64));
    });

    it('should sign data via enclave', async () => {
        const data = new Uint8Array([1, 2, 3]);
        const sig = await km.sign({ keyAlias: 'test', data });
        expect(sig).toBeInstanceOf(Uint8Array);
        expect(Buffer.from(sig).toString('hex')).toBe('b'.repeat(128));
    });
});
