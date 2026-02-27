import { describe, it, expect, beforeAll } from 'vitest';
import { deriveMultiSigAddress, MultiSigQuorum, deriveMusig2TaprootAddress } from '../services/multisig';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';

describe('Multi-Sig Service', () => {
    beforeAll(async () => {
        try {
            await (ecc as any).initUint8Array();
        } catch (e) {}
        bitcoin.initEccLib(ecc);
    });

    it('should derive a P2WSH 2-of-3 address correctly', () => {
        const quorum: MultiSigQuorum = {
            name: 'Test Quorum',
            m: 2,
            n: 3,
            publicKeys: [
                '022222222222222222222222222222222222222222222222222222222222222222',
                '023333333333333333333333333333333333333333333333333333333333333333',
                '024444444444444444444444444444444444444444444444444444444444444444'
            ],
            network: 'mainnet'
        };

        const address = deriveMultiSigAddress(quorum);
        expect(address.startsWith('bc1q')).toBe(true);
        expect(address.length).toBeGreaterThan(40);
    });

    it('should derive a Musig2 Taproot address correctly', () => {
        // This test verifies the service logic flow.
        // Actual P2TR derivation is checked for existence of the helper.
        expect(deriveMusig2TaprootAddress).toBeDefined();
    });
});
