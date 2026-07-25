import * as bitcoin from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import type { Network } from '../../types';

function networkFrom(network: Network) {
  return network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
}

export function getNativePsbtSighashes(
  psbtBase64: string,
  pubkey: Buffer,
  network: Network,
): { hash: Buffer; index: number }[] {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: networkFrom(network) });
  const hashes: { hash: Buffer; index: number }[] = [];
  const captureSigner = {
    publicKey: pubkey,
    sign: (hash: Buffer) => {
      hashes.push({ hash, index: -1 });
      return Buffer.alloc(64);
    },
  };

  for (let index = 0; index < psbt.inputCount; index += 1) {
    const previousLength = hashes.length;
    try {
      psbt.signInput(index, captureSigner);
    } catch {
      // Unsupported inputs fail later when no native sighash was captured.
    }
    if (hashes.length > previousLength) hashes[hashes.length - 1].index = index;
  }
  return hashes;
}

export function finalizeNativePsbt(
  psbtBase64: string,
  signatures: { index: number; signature: Buffer }[],
  pubkey: Buffer,
  network: Network,
): string {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: networkFrom(network) });
  signatures.forEach(({ index, signature }) => {
    psbt.signInput(index, { publicKey: pubkey, sign: () => signature });
  });
  psbt.finalizeAllInputs();
  return Buffer.from(psbt.extractTransaction().toBuffer()).toString('hex');
}

export function getNativeUnsignedTxHex(psbtBase64: string, network: Network): string {
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: networkFrom(network) });
  const tx = (psbt.data.globalMap.unsignedTx as unknown as { tx: { toBuffer(): Uint8Array } }).tx;
  return Buffer.from(tx.toBuffer()).toString('hex');
}
