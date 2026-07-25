import * as bitcoin from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import type { Network } from '../../types';
import type { SignRequest, SignResult } from '../signer';
import { finalizeNativePsbt, getNativePsbtSighashes, getNativeUnsignedTxHex } from './native-psbt';
import { signNativeValue, signNativeValueBatch } from './native-value-signing';

const NATIVE_LAYER_PATHS: Readonly<Record<string, string>> = Object.freeze({
  Mainnet: "m/84'/0'/0'/0/0", Stacks: "m/44'/5757'/0'/0/0", Rootstock: "m/44'/60'/0'/0/0",
  Ethereum: "m/44'/60'/0'/0/0", Lightning: "m/84'/0'/0'/0/0", Liquid: "m/84'/1776'/0'/0/0",
  Runes: "m/86'/0'/0'/0/0", Ordinals: "m/86'/0'/0'/0/0", BOB: "m/44'/60'/0'/0/0",
  RGB: "m/86'/0'/0'/0/0", Ark: "m/84'/0'/0'/1/0", BitVM: "m/84'/0'/0'/4/0",
  Maven: "m/84'/0'/0'/3/0", B2: "m/44'/60'/0'/0/0", Botanix: "m/44'/60'/0'/0/0",
  Mezo: "m/44'/60'/0'/0/0", Alpen: "m/44'/60'/0'/0/0", Zulu: "m/44'/60'/0'/0/0",
  Bison: "m/44'/60'/0'/0/0", Hemi: "m/44'/60'/0'/0/0", Nubit: "m/44'/60'/0'/0/0",
  Lorenzo: "m/44'/60'/0'/0/0", Citrea: "m/44'/60'/0'/0/0", Babylon: "m/44'/60'/0'/0/0",
  Merlin: "m/44'/60'/0'/0/0", Bitlayer: "m/44'/60'/0'/0/0", TaprootAssets: "m/86'/0'/0'/0/0",
  Silent: "m/352'/0'/0'/0'/0",
});

export async function signAuthorizedValueOperation(request: SignRequest, vault: string): Promise<SignResult> {
  const network: Network = 'mainnet';
  let path = NATIVE_LAYER_PATHS[request.layer] ?? NATIVE_LAYER_PATHS.Mainnet;
  if (request.layer === 'StateChain') path = `m/84'/0'/0'/2/${request.payload?.index || 0}`;

  if (request.payload?.psbt) {
    const identity = await signNativeValue({ vault, path, messageHash: 'PUBKEY_DERIVATION', network });
    const pubkey = identity.pubkey;
    const pubkeyBuffer = Buffer.from(pubkey, 'hex');
    const hashes = getNativePsbtSighashes(request.payload.psbt, pubkeyBuffer, network);
    const batch = await signNativeValueBatch({
      vault,
      path,
      hashes: hashes.map(({ hash }) => hash.toString('hex')),
      network,
      payload: getNativeUnsignedTxHex(request.payload.psbt, network),
    });
    const signatures = batch.signatures.map((result, index) => ({
      index: hashes[index].index,
      signature: Buffer.from(result.signature, 'hex'),
    }));
    return {
      signature: batch.signatures[0]?.signature || '',
      pubkey,
      broadcastReadyHex: finalizeNativePsbt(request.payload.psbt, signatures, pubkeyBuffer, network),
      timestamp: Date.now(),
    };
  }

  const messageHash = request.payload?.hash
    || Buffer.from(bitcoin.crypto.sha256(Buffer.from(JSON.stringify(request.payload)))).toString('hex');
  const result = await signNativeValue({
    vault,
    path,
    messageHash,
    network: request.layer === 'RGB' ? 'rgb' : request.layer === 'StateChain' ? 'statechain' : network,
    payload: JSON.stringify(request.payload),
  });
  return { signature: result.signature, pubkey: result.pubkey, timestamp: Date.now() };
}
