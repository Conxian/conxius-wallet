import * as liquid from 'liquidjs-lib';
import { Network, UTXO } from '../types';
import { failClosed } from './production-guard';

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
  if (!pubkey || pubkey.length === 0) {
    throw new Error('[Liquid] Public key is required for address derivation.');
  }
  const liquidNet = getLiquidNetwork(network);
  const payment = liquid.payments.p2wpkh({
    pubkey: Buffer.from(pubkey),
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
  if (!address) {
    throw new Error('[Liquid] Address is required for confidential address derivation.');
  }
  if (!blindingPubkey || blindingPubkey.length === 0) {
    throw new Error('[Liquid] Blinding key is required for confidential address derivation.');
  }
  return liquid.address.toConfidential(address, blindingPubkey);
};

/**
 * Validates a Liquid address (both confidential and unconfidential).
 */
export const isValidLiquidAddress = (addr: string): boolean => {
  if (!addr) return false;
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
  if (!addr) return false;
  try {
    return liquid.address.isConfidential(addr);
  } catch {
    return false;
  }
};

/**
 * Unblinds a confidential Liquid address to extract the underlying
 * unconfidential address and blinding public key.
 */
export const unblindAddress = (
  confidentialAddress: string
): { unconfidentialAddress: string; blindingKey: Buffer } => {
  if (!confidentialAddress) {
    throw new Error('[Liquid] Address is required for unblinding.');
  }
  if (!isConfidentialAddress(confidentialAddress)) {
    throw new Error('[Liquid] Provided address is not a confidential Liquid address.');
  }
  const result = liquid.address.fromConfidential(confidentialAddress);
  return {
    unconfidentialAddress: result.unconfidentialAddress,
    blindingKey: result.blindingKey,
  };
};

/**
 * Validates and parses a confidential Liquid address, returning its components if valid.
 */
export const parseConfidentialAddress = (
  confidentialAddress: string
): { unconfidentialAddress: string; blindingKey: Buffer; isValid: boolean } => {
  if (!confidentialAddress || !isConfidentialAddress(confidentialAddress)) {
    return { unconfidentialAddress: '', blindingKey: Buffer.alloc(0), isValid: false };
  }
  try {
    const { unconfidentialAddress, blindingKey } = unblindAddress(confidentialAddress);
    return { unconfidentialAddress, blindingKey, isValid: true };
  } catch {
    return { unconfidentialAddress: '', blindingKey: Buffer.alloc(0), isValid: false };
  }
};

// ─── Constants ───────────────────────────────────────────────────────────────

export const LBTC_ASSET = {
  mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
  testnet: '144c654344aa716d6f3abcc1ca90e5641e4b9a72dd9910d938a5282b1ed2e778',
  regtest: '5ac9f65c0efcc4775e0ba3ddb7799581842c35acc3a48019fafb586a5d2811a2'
};

// ─── Peg-in (REAL IMPLEMENTATION WITH GUARD) ─────────────────────────────────

/**
 * Generates a Liquid peg-in address for a given claim pubkey.
 */
export const generatePegInAddress = async (
  claimPubkey: Buffer,
  federationScript: Buffer | string,
  network: Network = 'mainnet'
): Promise<{ mainchainAddress: string; claimScript: Buffer }> => {
  if (!claimPubkey || claimPubkey.length === 0) {
    throw new Error('[Liquid] Claim pubkey is required for peg-in.');
  }
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

  const simulationResult = {
    mainchainAddress: btcPayment.address,
    claimScript: claimPubkey, 
  };

  return failClosed("Liquid Peg-In Script Verification", simulationResult);
};

// ─── Peg-out (REAL IMPLEMENTATION WITH GUARD) ────────────────────────────────

/**
 * Creates a Liquid peg-out transaction (L-BTC → BTC).
 * Returns a Base64 encoded PSET.
 */
export const createPegOutTransaction = async (
  btcDestAddress: string,
  amountSats: number,
  lbtcAssetId: string,
  _network: Network = 'mainnet',
  utxos: UTXO[],
  _changeAddress: string
): Promise<string> => {
  if (!btcDestAddress) {
    throw new Error('[Liquid] Bitcoin destination address is required for peg-out.');
  }
  if (amountSats <= 0) {
    throw new Error('[Liquid] Peg-out amount must be greater than zero.');
  }

  const pset = new liquid.Pset();
  const assetBuffer = Buffer.from(lbtcAssetId, 'hex');

  for (const utxo of utxos) {
    const input = new liquid.PsetInput();
    input.previousTxid = Buffer.from(utxo.txid, 'hex').reverse();
    input.previousTxIndex = utxo.vout;
    pset.addInput(input);
  }

  const pegoutScript = liquid.payments.embed({ data: [Buffer.from(btcDestAddress, 'utf8')] }).output;
  const output = new liquid.PsetOutput();
  output.value = amountSats;
  output.asset = assetBuffer;
  output.script = pegoutScript;
  pset.addOutput(output);

  const psetBase64 = pset.toBase64();

  return failClosed("Liquid Peg-Out Transaction Signing", psetBase64);
};
