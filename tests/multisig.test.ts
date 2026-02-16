import { describe, it, expect } from 'vitest';
import { deriveMultiSigAddress, MultiSigQuorum } from '../services/multisig';

describe('Multi-Sig Service', () => {
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
});
