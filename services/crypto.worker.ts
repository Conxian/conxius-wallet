// @ts-nocheck
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';

const bip32 = BIP32Factory(ecc);

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    try {
        if (type === 'DERIVE_ADDRESS') {
            const seed = payload.seed;
            const root = bip32.fromSeed(Buffer.from(seed, 'hex'));
            const child = root.derivePath(payload.path);
            const { address } = bitcoin.payments.p2wpkh({
                pubkey: child.publicKey,
                network: payload.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
            });
            self.postMessage({ type: 'SUCCESS', result: { address, pubkey: child.publicKey.toString('hex') } });
        }
    } catch (err) {
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};
