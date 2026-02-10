import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { UTXO, Network, Signer as LocalSigner } from '../types';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

function networkFrom(network: Network) {
  return network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
}

function coinType(network: Network) {
  return network === 'mainnet' ? 0 : 1;
}

export function estimateVbytes(inputs: number, outputs: number) {
  return Math.max(10 + inputs * 68 + outputs * 31, 110);
}

export function buildPsbt(params: {
  utxos: UTXO[];
  toAddress: string;
  amountSats: number;
  changeAddress: string;
  feeRate: number;
  rbf?: boolean;
  network: Network;
  memo?: string;
}) {
  const net = networkFrom(params.network);
  const psbt = new bitcoin.Psbt({ network: net });
  let totalIn = 0;
  params.utxos.forEach(u => {
    totalIn += u.amount;
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      sequence: params.rbf ? 0xfffffffd : undefined,
      witnessUtxo: {
        script: bitcoin.payments.p2wpkh({ address: u.address, network: net })!.output!,
        value: BigInt(u.amount)
      }
    });
  });

  // OP_RETURN Memo (THORChain / Notes)
  if (params.memo) {
    const data = Buffer.from(params.memo, 'utf8');
    const embed = bitcoin.payments.embed({ data: [data] });
    psbt.addOutput({ script: embed.output!, value: 0n });
  }

  const vbytes = estimateVbytes(params.utxos.length, 2 + (params.memo ? 1 : 0));
  const fee = Math.floor(vbytes * params.feeRate);
  const change = totalIn - params.amountSats - fee;
  if (change < 0) {
    throw new Error('Insufficient funds');
  }
  psbt.addOutput({ address: params.toAddress, value: BigInt(params.amountSats) });
  psbt.addOutput({ address: params.changeAddress, value: BigInt(change) });
  return psbt.toBase64();
}

/**
 * Builds a PSBT for sBTC Peg-in (Stacks)
 * Includes an OP_RETURN output with the Stacks address.
 */
export function buildSbtcPegInPsbt(params: {
    utxos: UTXO[];
    stacksAddress: string;
    amountSats: number;
    changeAddress: string;
    feeRate: number;
    network: Network;
    pegInAddress: string; // The sBTC wallet address on BTC L1
}) {
    const net = networkFrom(params.network);
    const psbt = new bitcoin.Psbt({ network: net });
    let totalIn = 0;

    params.utxos.forEach(u => {
        totalIn += u.amount;
        psbt.addInput({
            hash: u.txid,
            index: u.vout,
            witnessUtxo: {
                script: bitcoin.payments.p2wpkh({ address: u.address, network: net })!.output!,
                value: BigInt(u.amount)
            }
        });
    });

    // Output 1: Peg-in Address
    psbt.addOutput({ address: params.pegInAddress, value: BigInt(params.amountSats) });

    // Output 2: OP_RETURN with Stacks Address (sBTC Protocol)
    const data = Buffer.from(params.stacksAddress);
    const embed = bitcoin.payments.embed({ data: [data] });
    psbt.addOutput({ script: embed.output!, value: 0n });

    const vbytes = estimateVbytes(params.utxos.length, 3);
    const fee = Math.floor(vbytes * params.feeRate);
    const change = totalIn - params.amountSats - fee;

    if (change > 546) {
        psbt.addOutput({ address: params.changeAddress, value: BigInt(change) });
    }

    return psbt.toBase64();
}

export async function signPsbtBase64(mnemonic: string, psbtBase64: string, network: Network) {
  const seed = await (await import('bip39')).mnemonicToSeed(mnemonic);
  try {
    return await signPsbtBase64WithSeed(seed, psbtBase64, network);
  } finally {
    if (seed instanceof Uint8Array) {
      seed.fill(0);
    }
  }
}

export async function signPsbtBase64WithSeed(seed: Uint8Array, psbtBase64: string, network: Network) {
  const root = bip32.fromSeed(Buffer.from(seed));
  const net = networkFrom(network);
  const coin = coinType(network);

  const p2wpkhPath = `m/84'/${coin}'/0'/0/0`;
  const p2trPath = `m/86'/${coin}'/0'/0/0`;

  const p2wpkhChild = root.derivePath(p2wpkhPath);
  const p2trChild = root.derivePath(p2trPath);

  const p2wpkhKeyPair: any = ECPair.fromPrivateKey(Buffer.from(p2wpkhChild.privateKey!), { network: net });

  // Taproot Key Tweak for Key-path signing
  const internalPubkey = Buffer.from(p2trChild.publicKey.slice(1, 33));
  const p2trKeyPair: any = ECPair.fromPrivateKey(Buffer.from(p2trChild.privateKey!), { network: net });

  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: net });

  for (let i = 0; i < psbt.inputCount; i++) {
    const input = psbt.data.inputs[i];

    // Check if it's a Taproot input (v1 witness program: 0x51 + length 0x20)
    const isTaproot = input.witnessUtxo &&
                      input.witnessUtxo.script.length === 34 &&
                      input.witnessUtxo.script[0] === 0x51 &&
                      input.witnessUtxo.script[1] === 0x20;

    if (isTaproot) {
        // Tweak the key for key-path signing if not already tweaked
        const tweakedChild: any = (p2trChild as any).tweak(
            Buffer.from(bitcoin.crypto.taggedHash('TapTweak', internalPubkey)),
        );
        if (!tweakedChild.privateKey) throw new Error('Failed to derive tweaked private key');
        const tweakedKeyPair: any = ECPair.fromPrivateKey(Buffer.from(tweakedChild.privateKey), { network: net });
        psbt.signInput(i, tweakedKeyPair);
    } else {
        psbt.signInput(i, p2wpkhKeyPair as any);
    }
  }

  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}

export function getPsbtSighashes(
  psbtBase64: string,
  pubkey: Buffer,
  network: Network,
): { hash: Buffer; index: number }[] {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, {
    network: networkFrom(network),
  });
  const hashes: { hash: Buffer; index: number }[] = [];

  // Dummy signer to capture hashes
  const captureSigner = {
    publicKey: pubkey,
    sign: (hash: Buffer) => {
      hashes.push({ hash, index: -1 }); // index update below
      return Buffer.alloc(64);
    },
  };

  for (let i = 0; i < psbt.inputCount; i++) {
    const startLen = hashes.length;
    try {
      psbt.signInput(i, captureSigner);
    } catch (e) {}
    if (hashes.length > startLen) {
      hashes[hashes.length - 1].index = i;
    }
  }
  return hashes;
}

export function finalizePsbtWithSigs(
  psbtBase64: string,
  signatures: { index: number; signature: Buffer }[],
  pubkey: Buffer,
  network: Network,
) {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, {
    network: networkFrom(network),
  });

  signatures.forEach((sigItem) => {
    const signer = {
      publicKey: pubkey,
      sign: () => sigItem.signature,
    };
    psbt.signInput(sigItem.index, signer);
  });

  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}

export function finalizePsbtWithSigsReturnBase64(
  psbtBase64: string,
  signatures: { index: number; signature: Buffer }[],
  pubkey: Buffer,
  network: Network,
) {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, {
    network: networkFrom(network),
  });

  signatures.forEach((sigItem) => {
    const signer = {
      publicKey: pubkey,
      sign: () => sigItem.signature,
    };
    psbt.signInput(sigItem.index, signer);
  });

  psbt.finalizeAllInputs();
  return psbt.toBase64();
}

export function getUnsignedTxHex(psbtBase64: string, network: Network) {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: networkFrom(network) });
  return psbt.data.globalMap.unsignedTx.toHex();
}
