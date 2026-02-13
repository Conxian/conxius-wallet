
import { describe, it, expect } from 'vitest';
import { NttTransceiver } from '../services/ntt-transceiver';
import { EthAdapter } from '../services/eth-adapter';
import { Buffer } from 'buffer';

describe('Sovereign Ecosystem Integrations', () => {
    describe('NttTransceiver', () => {
        it('should format a sovereign VAA correctly', () => {
            const payload = new Uint8Array([1, 2, 3, 4]);
            const signature = new Uint8Array(65).fill(0xaa);
            const emitterAddress = new Uint8Array(32).fill(0xbb);
            const emitterChain = 1;
            const sequence = 100n;

            const vaa = NttTransceiver.formatSovereignVaa(
                payload,
                signature,
                emitterChain,
                emitterAddress,
                sequence
            );

            expect(vaa[0]).toBe(1); // Version
            expect(vaa[5]).toBe(1); // Sig count
            expect(vaa[6]).toBe(0); // Guardian index 0
            expect(vaa[81]).toBe(1); // Emitter chain (lower byte of uint16)
            expect(Buffer.from(vaa.slice(123, 127))).toEqual(Buffer.from([1, 2, 3, 4])); // Payload
        });

        it('should create an NTT payload', () => {
            const amount = 100000000n;
            const decimals = 8;
            const sourceToken = new Uint8Array(32).fill(0xee);
            const recipient = new Uint8Array(32).fill(1);
            const recipientChain = 2;
            const payload = NttTransceiver.createNttPayload(
                amount,
                decimals,
                sourceToken,
                recipient,
                recipientChain
            );

            expect(payload[0]).toBe(0x99); // Prefix 0x99
            expect(payload[1]).toBe(0x4e); // Prefix N
            expect(payload[4]).toBe(8); // Decimals byte
            expect(Buffer.from(payload.slice(13, 45))).toEqual(Buffer.from(sourceToken));
            expect(Buffer.from(payload.slice(45, 77))).toEqual(Buffer.from(recipient));
            expect(payload.length).toBe(81);
        });
    });

    describe('EthAdapter', () => {
        it('should compute a typed data hash (EIP-712)', () => {
            const domain = {
                name: 'Conxius',
                version: '1',
                chainId: 1,
                verifyingContract: '0x0000000000000000000000000000000000000000'
            };
            const types = {
                Transfer: [
                    { name: 'to', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                ]
            };
            const message = {
                to: '0x1234567890123456789012345678901234567890',
                amount: 100n
            };

            const hash = EthAdapter.hashTypedData(domain, 'Transfer', message, types);
            expect(hash).toBeDefined();
            expect(hash.length).toBe(32);
        });
    });
});
