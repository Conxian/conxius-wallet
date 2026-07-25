import * as bitcoin from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import { UTXO, Network } from '../types';

function networkFrom(network: Network) {
  return network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
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
    } catch {}
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
  return Buffer.from(psbt.extractTransaction().toBuffer()).toString('hex');
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
  // unsignedTx is technically an internal property, cast to any to avoid TS issues
  const tx = (psbt.data.globalMap.unsignedTx as any).tx;
  return Buffer.from(tx.toBuffer()).toString('hex');
}

/**
 * Builds a PSBT for a Native Peg-in to any Bitcoin Layer.
 * Supports optional OP_RETURN data for protocol-specific routing (e.g. sBTC, BOB).
 */
export function buildNativePegPsbt(params: {
    utxos: UTXO[];
    amountSats: number;
    changeAddress: string;
    feeRate: number;
    network: Network;
    pegInAddress: string;
    opReturnData?: string;
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

    // Output 2: OP_RETURN (Optional)
    if (params.opReturnData) {
        const data = Buffer.from(params.opReturnData);
        const embed = bitcoin.payments.embed({ data: [data] });
        psbt.addOutput({ script: embed.output!, value: 0n });
    }

    const outputCount = params.opReturnData ? 3 : 2;
    const vbytes = estimateVbytes(params.utxos.length, outputCount);
    const fee = Math.floor(vbytes * params.feeRate);
    const change = totalIn - params.amountSats - fee;

    if (change > 546) {
        psbt.addOutput({ address: params.changeAddress, value: BigInt(change) });
    }

    return psbt.toBase64();
}
