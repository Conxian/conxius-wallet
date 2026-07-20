import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { mnemonicToSeedSync } from 'bip39';
import { describe, expect, it } from 'vitest';
import fixture from '../native/silent-payments-jni/tests/fixtures/bip32-cross-language.json';

const bip32 = BIP32Factory(ecc);

describe('silent-payment BIP32 cross-language fixture', () => {
    it('matches native scan/spend public keys for every public-only vector', () => {
        const passphrase = Buffer.from(fixture.passphrase_bytes).toString('utf8');
        const seed = mnemonicToSeedSync(fixture.mnemonic, passphrase);
        const root = bip32.fromSeed(seed);

        for (const vector of fixture.vectors) {
            const scanNode = root.derivePath(vector.scan_path);
            const spendNode = root.derivePath(vector.spend_path);
            expect(Buffer.from(scanNode.publicKey).toString('hex')).toBe(vector.scan_pub);
            expect(Buffer.from(spendNode.publicKey).toString('hex')).toBe(vector.spend_pub);
        }
    });
});
