import { describe, it, expect } from 'vitest';
import { parseRgbInvoice, validateConsignment } from '../services/rgb';
import { fetchActiveRounds, registerInputs } from '../services/coinjoin';
import { deriveSilentPaymentKeys, encodeSilentPaymentAddress, decodeSilentPaymentAddress } from '../services/silent-payments';
import { aggregatePubkeys, generateMusig2Nonce, signPartialMusig2 } from '../services/musig2';
import { Buffer } from 'buffer';

describe('Refined Services Production Alignment', () => {

    describe('RGB Service', () => {
        it('should perform structural validation of consignments', async () => {
            const invalidConsignment: any = { id: '1', assetId: 'not-rgb', witness: 'short' };
            const isValid = await validateConsignment(invalidConsignment);
            expect(isValid).toBe(false);
        });
    });

    describe('CoinJoin Service', () => {
        it('should simulate dynamic phases and WabiSabi credentials', async () => {
            const rounds = await fetchActiveRounds('mainnet');
            expect(rounds[0].phase).toBeDefined();

            const utxos: any = [{ txid: '00'.repeat(32), vout: 0, amount: 100000, address: 'addr1', status: 'confirmed', isFrozen: false, derivationPath: 'm/84/0/0/0/0', privacyRisk: 'Low' }];
            const result = await registerInputs('round1', utxos, 'change', 'mainnet');
            expect(result.credentials.length).toBe(1);
            expect(result.credentials[0].amount).toBe(100000);
            expect(result.credentials[0].presentation).toContain('blinded_');
        });
    });

    describe('Silent Payments', () => {
        it('should derive consistent keys and encode/decode addresses', () => {
            const seed = Buffer.alloc(64, 1);
            const keys = deriveSilentPaymentKeys(seed);
            const address = encodeSilentPaymentAddress(keys.scanPub, keys.spendPub, 'mainnet');
            expect(address.startsWith('sp1')).toBe(true);

            const decoded = decodeSilentPaymentAddress(address);
            expect(decoded.scanPub).toEqual(keys.scanPub);
            expect(decoded.spendPub).toEqual(keys.spendPub);
        });
    });

    describe('Musig2 BIP-327', () => {
        it('should process keys', () => {
            const pk1 = Buffer.from('02' + '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex');
            const pk2 = Buffer.from('02' + 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5', 'hex');
            const agg = aggregatePubkeys([pk1, pk2]);
            expect(agg.length).toBe(32);
        });
    });
});
