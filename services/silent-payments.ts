import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { bech32m } from 'bech32';
import { Buffer } from 'buffer';

const bip32 = BIP32Factory(ecc);
const CURVE_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

export interface SilentPaymentKeys {
    scanKey: Buffer;
    spendKey: Buffer;
    scanPub: Buffer;
    spendPub: Buffer;
}

/**
 * Derives Silent Payment keys based on BIP-352
 * Path: m/352'/0'/0'/10/0 for scan key
 * Path: m/352'/0'/0'/10/1 for spend key
 */
export const deriveSilentPaymentKeys = (seed: Buffer): SilentPaymentKeys => {
    const root = bip32.fromSeed(seed);

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
    const version = 0;

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
        hrp: decoded.prefix || (decoded as any).hrp,
        version,
        scanPub: Buffer.from(data.slice(0, 33)),
        spendPub: Buffer.from(data.slice(33, 66))
    };
};

/**
 * Creates a Silent Payment output (Sending side)
 */
export const createSilentPaymentOutput = (
    recipientAddress: string,
    senderPrivateKeys: Buffer[],
    outpoints: { txid: string, vout: number }[]
) => {
    const { scanPub, spendPub } = decodeSilentPaymentAddress(recipientAddress);

    // 1. Sum of private keys (a)
    let a = BigInt(0);
    for (const key of senderPrivateKeys) {
        a = (a + BigInt('0x' + key.toString('hex'))) % CURVE_N;
    }

    // 2. Input Hash
    const outpointData = Buffer.concat(outpoints.sort((a,b) => a.txid.localeCompare(b.txid)).map(o => Buffer.concat([Buffer.from(o.txid, 'hex').reverse(), Buffer.alloc(4).fill(o.vout)])));
    const inputHash = Buffer.from((bitcoin.crypto as any).taggedHash('BIP352/Inputs', outpointData));

    // 3. Shared Secret S = inputHash * a * ScanPub
    const factor = (BigInt('0x' + Buffer.from(inputHash).toString('hex')) * a) % CURVE_N;
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

/**
 * Scans a transaction for Silent Payment outputs (Receiving side)
 */
export const scanTransactionForOutputs = (
    tx: bitcoin.Transaction,
    inputPubkeys: Buffer[],
    scanPrivKey: Buffer,
    spendPubKey: Buffer
): { vout: number, amount: number, address: string }[] => {
    const foundOutputs: any[] = [];

    // 1. Calculate sum of input public keys (A)
    let A = inputPubkeys[0];
    for(let i=1; i<inputPubkeys.length; i++) {
        const nextA = ecc.pointAdd(A, inputPubkeys[i]);
        if (nextA) A = Buffer.from(nextA);
    }

    // 2. Calculate input hash
    const outpoints = tx.ins.map(i => ({ txid: Buffer.from(i.hash).reverse().toString('hex'), vout: i.index }));
    const outpointData = Buffer.concat(outpoints.sort((a,b) => a.txid.localeCompare(b.txid)).map(o => Buffer.concat([Buffer.from(o.txid, 'hex').reverse(), Buffer.alloc(4).fill(o.vout)])));
    const inputHash = Buffer.from((bitcoin.crypto as any).taggedHash('BIP352/Inputs', outpointData));

    // 3. Calculate shared secret S = inputHash * scan_priv * A
    const factor = (BigInt('0x' + Buffer.from(inputHash).toString('hex')) * BigInt('0x' + scanPrivKey.toString('hex'))) % CURVE_N;
    const factorBuf = Buffer.from(factor.toString(16).padStart(64, '0'), 'hex');

    const sharedSecretPoint = ecc.pointMultiply(A, factorBuf);
    if (!sharedSecretPoint) return [];

    // 4. For each output, check if it matches the tweaked spend pubkey
    const tweak = Buffer.from((bitcoin.crypto as any).taggedHash('BIP352/SharedSecret', sharedSecretPoint));
    const tweakedSpendPub = ecc.pointAdd(spendPubKey, ecc.pointMultiply(Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex'), tweak)!);
    const tweakedXOnly = Buffer.from(tweakedSpendPub!).slice(1, 33);

    tx.outs.forEach((output, index) => {
        // Taproot output script is 0x51 0x20 <32-byte-x-only-pubkey>
        if (output.script.length === 34 && output.script[0] === 0x51 && output.script[1] === 0x20) {
            const outputXOnly = output.script.slice(2);
            if (outputXOnly.equals(tweakedXOnly)) {
                foundOutputs.push({
                    vout: index,
                    amount: output.value,
                    address: bitcoin.payments.p2tr({ pubkey: tweakedXOnly }).address
                });
            }
        }
    });

    return foundOutputs;
};
