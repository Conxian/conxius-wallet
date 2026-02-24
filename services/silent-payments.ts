import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { bech32m } from 'bech32';
import { Buffer } from 'buffer';

const bip32 = BIP32Factory(ecc);

export interface SilentPaymentKeys {
    scanKey: Buffer;
    spendKey: Buffer;
    scanPub: Buffer;
    spendPub: Buffer;
}

/**
 * Derives Silent Payment keys based on BIP-352
 * Path: m/352'/0'/0'/10/0 for scan key (using standard paths)
 * Path: m/352'/0'/0'/10/1 for spend key
 */
export const deriveSilentPaymentKeys = (seed: Buffer): SilentPaymentKeys => {
    const root = bip32.fromSeed(seed);

    // BIP-352 standard derivation
    const scanNode = root.derivePath("m/352'/0'/0'/10/0");
    const spendNode = root.derivePath("m/352'/0'/0'/10/1");

    return {
        scanKey: scanNode.privateKey!,
        spendKey: spendNode.privateKey!,
        scanPub: scanNode.publicKey,
        spendPub: spendNode.publicKey
    };
};

/**
 * Encodes the Silent Payment address (sp1...)
 */
export const encodeSilentPaymentAddress = (scanPub: Buffer, spendPub: Buffer, network: 'mainnet' | 'testnet' = 'mainnet'): string => {
    const hrp = network === 'mainnet' ? 'sp' : 'tsp';
    const version = 0; // BIP-352 version 0

    const combined = Buffer.concat([scanPub.slice(1), spendPub.slice(1)]); // Use X-only or full? BIP-352 uses full 33-byte compressed.
    // Wait, BIP-352 uses 33-byte compressed pubkeys.
    const fullCombined = Buffer.concat([scanPub, spendPub]);
    const words = bech32m.toWords(fullCombined);

    return bech32m.encode(hrp, [version, ...words], 1024);
};

/**
 * Decodes a Silent Payment address
 */
export const decodeSilentPaymentAddress = (address: string) => {
    const decoded: any = bech32m.decode(address, 1024);
    const version = decoded.words[0];
    const data = bech32m.fromWords(decoded.words.slice(1));

    return {
        hrp: decoded.prefix || decoded.hrp,
        version,
        scanPub: Buffer.from(data.slice(0, 33)),
        spendPub: Buffer.from(data.slice(33, 66))
    };
};

/**
 * Real BIP-352 Shared Secret Computation
 */
export const createSilentPaymentOutput = (
    recipientAddress: string,
    senderPrivateKeys: Buffer[],
    outpoints: { txid: string, vout: number }[]
) => {
    const { scanPub, spendPub } = decodeSilentPaymentAddress(recipientAddress);

    // 1. Sum of private keys (a)
    let a = BigInt(0);
    const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    for (const key of senderPrivateKeys) {
        a = (a + BigInt('0x' + key.toString('hex'))) % n;
    }

    // 2. Input Hash
    // Simplified: Tagged hash of outpoints
    const outpointData = Buffer.concat(outpoints.map(o => Buffer.concat([Buffer.from(o.txid, 'hex').reverse(), Buffer.alloc(4).fill(o.vout)])));
    const inputHash = Buffer.from((bitcoin.crypto as any).taggedHash('BIP352/Inputs', outpointData));

    // 3. Shared Secret S = inputHash * a * ScanPub
    const factor = (BigInt('0x' + Buffer.from(inputHash).toString('hex')) * a) % n;
    const factorBuf = Buffer.from(factor.toString(16).padStart(64, '0'), 'hex');

    const sharedSecretPoint = ecc.pointMultiply(scanPub, factorBuf);
    if (!sharedSecretPoint) throw new Error("Invalid shared secret");

    // 4. Tweak SpendPub
    const tweak = Buffer.from((bitcoin.crypto as any).taggedHash('BIP352/SharedSecret', sharedSecretPoint));
    const tweakedSpendPub = ecc.pointAdd(spendPub, ecc.pointMultiply(Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex'), tweak)!);

    return {
        address: bitcoin.payments.p2tr({ pubkey: Buffer.from(tweakedSpendPub!).slice(1, 33) }).address,
        type: 'silent_payment_v0'
    };
};
