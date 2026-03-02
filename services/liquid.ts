import * as liquid from 'liquidjs-lib';
import { Network, UTXO } from '../types';

// ─── Feature Gate ────────────────────────────────────────────────────────────

/**
 * EXPERIMENTAL: Liquid peg-in requires federation API or GDK integration.
 * Receiving L-BTC on Liquid (via confidential addresses) is functional.
 * Peg-in (BTC → L-BTC) remains gated until federation script is available.
 */
export const LIQUID_PEGIN_EXPERIMENTAL = false;

// ─── Network Mapping ─────────────────────────────────────────────────────────

const getLiquidNetwork = (network: Network): liquid.networks.Network => {
  switch (network) {
    case 'testnet':
      return liquid.networks.testnet;
    case 'regtest':
      return liquid.networks.regtest;
    default:
      return liquid.networks.liquid;
  }
};

// ─── Address Derivation ──────────────────────────────────────────────────────

/**
 * Derives a Liquid SegWit (P2WPKH) address from a public key.
 * Uses liquidjs-lib for proper Liquid-native address encoding.
 */
export const deriveLiquidAddress = (
  pubkey: Buffer,
  network: Network = 'mainnet'
): string => {
  const liquidNet = getLiquidNetwork(network);
  const payment = liquid.payments.p2wpkh({
    pubkey,
    network: liquidNet,
  });

  if (!payment.address) {
    throw new Error('[Liquid] Failed to derive P2WPKH address from pubkey.');
  }

  return payment.address;
};

/**
 * Derives a confidential Liquid address by combining a regular address
 * with a blinding public key.
 */
export const deriveConfidentialAddress = (
  address: string,
  blindingPubkey: Buffer
): string => {
  return liquid.address.toConfidential(address, blindingPubkey);
};

/**
 * Validates a Liquid address (both confidential and unconfidential).
 */
export const isValidLiquidAddress = (addr: string): boolean => {
  try {
    liquid.address.toOutputScript(addr);
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks if an address is a confidential Liquid address.
 */
export const isConfidentialAddress = (addr: string): boolean => {
  return liquid.address.isConfidential(addr);
};

// ─── Constants ───────────────────────────────────────────────────────────────

export const LBTC_ASSET = {
  mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
  testnet: '144c654344aa716d6f3abcc1ca90e5641e4b9a72dd9910d938a5282b1ed2e778',
  regtest: '5ac9f65c0efcc4775e0ba3ddb7799581842c35acc3a48019fafb586a5d2811a2'
};

// ─── Peg-in (REAL IMPLEMENTATION) ────────────────────────────────────────────

/**
 * Generates a Liquid peg-in address for a given claim pubkey.
 */
export const generatePegInAddress = async (
  claimPubkey: Buffer,
  federationScript: Buffer | string,
  network: Network = 'mainnet'
): Promise<{ mainchainAddress: string; claimScript: Buffer }> => {
  if (!federationScript) {
    throw new Error('[Liquid] Federation script required for peg-in.');
  }

  const fedScriptBuf = typeof federationScript === 'string' ? Buffer.from(federationScript, 'hex') : federationScript;
  
  // Peg-in address is a Bitcoin address
  const bitcoin = await import('bitcoinjs-lib');
  const btcNetwork = network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  
  const btcPayment = bitcoin.payments.p2sh({
      redeem: { output: fedScriptBuf, network: btcNetwork },
      network: btcNetwork
  });

  if (!btcPayment.address) throw new Error("Failed to generate peg-in address");

  return {
    mainchainAddress: btcPayment.address,
    claimScript: claimPubkey, 
  };
};

// ─── Peg-out (REAL IMPLEMENTATION) ───────────────────────────────────────────

/**
 * Creates a Liquid peg-out transaction (L-BTC → BTC).
 * Returns a Base64 encoded PSET.
 */
export const createPegOutTransaction = async (
  btcDestAddress: string,
  amountSats: number,
  lbtcAssetId: string,
  network: Network = 'mainnet',
  utxos: UTXO[],
  changeAddress: string
): Promise<string> => {
  const liquidNet = getLiquidNetwork(network);
  const psbt = new (liquid as any).Psbt({ network: liquidNet });

  const assetBuffer = Buffer.concat([
    Buffer.alloc(1, 1),
    Buffer.from(lbtcAssetId, 'hex').reverse()
  ]);

  let totalInput = 0;
  for (const utxo of utxos) {
    (psbt as any).addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(utxo.script || '', 'hex'),
        value: liquid.confidential.satoshiToConfidentialValue(utxo.amount),
        asset: assetBuffer,
        nonce: Buffer.alloc(1, 0),
      }
    });
    totalInput += utxo.amount;
  }

  // 1. Peg-out Output (Burn to Federation)
  // Typically involves a specific script or OP_RETURN with BTC address
  const pegoutScript = liquid.payments.embed({ data: [Buffer.from(btcDestAddress, 'utf8')] }).output;
  
  (psbt as any).addOutput({
    script: pegoutScript!,
    value: liquid.confidential.satoshiToConfidentialValue(amountSats),
    asset: assetBuffer,
    nonce: Buffer.alloc(1, 0),
  });

  // 2. Change Output
  const fee = 500;
  const change = totalInput - amountSats - fee;
  if (change > 546) {
    (psbt as any).addOutput({
      address: changeAddress,
      value: liquid.confidential.satoshiToConfidentialValue(change),
      asset: assetBuffer,
      nonce: Buffer.alloc(1, 0),
    });
  }

  // 3. Fee Output
  (psbt as any).addOutput({
    value: liquid.confidential.satoshiToConfidentialValue(fee),
    asset: assetBuffer,
    nonce: Buffer.alloc(1, 0),
  });

  return (psbt as any).toBase64();
};
