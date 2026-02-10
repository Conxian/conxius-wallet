
import * as liquid from 'liquidjs-lib';
import { Network } from '../types';

// ─── Feature Gate ────────────────────────────────────────────────────────────

/**
 * EXPERIMENTAL: Liquid peg-in requires federation API or GDK integration.
 * Receiving L-BTC on Liquid (via confidential addresses) is functional.
 * Peg-in (BTC → L-BTC) remains gated until federation script is available.
 */
export const LIQUID_PEGIN_EXPERIMENTAL = true;

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
 *
 * @param pubkey - Compressed public key (33 bytes)
 * @param network - Target network (mainnet/testnet/regtest)
 * @returns Liquid bech32 address (ex prefix on mainnet)
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
 * with a blinding public key. Confidential addresses are the default
 * on Liquid for transaction privacy.
 *
 * @param address - Unconfidential Liquid address
 * @param blindingPubkey - EC public key used for confidential transactions (33 bytes)
 * @returns Confidential Liquid address
 */
export const deriveConfidentialAddress = (
  address: string,
  blindingPubkey: Buffer
): string => {
  return liquid.address.toConfidential(address, blindingPubkey);
};

/**
 * Validates a Liquid address (both confidential and unconfidential).
 * Returns true if the address is parseable by liquidjs-lib.
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

// ─── Peg-in (EXPERIMENTAL) ──────────────────────────────────────────────────

/**
 * Generates a Liquid peg-in address for a given claim pubkey.
 *
 * Peg-in flow:
 * 1. User provides a Liquid claim pubkey (derived from m/84'/1776'/0'/0/0)
 * 2. The federation script is combined with the claim pubkey to produce a BTC address
 * 3. User sends BTC to this address
 * 4. After 102 Bitcoin confirmations, L-BTC is claimable on Liquid
 *
 * EXPERIMENTAL: Requires either:
 * - Blockstream GDK (Green Development Kit) for federation script
 * - A Liquid node with `getpeginaddress` RPC
 * - Federation script hardcoded (not recommended — changes on federation rotations)
 *
 * @throws Error when LIQUID_PEGIN_EXPERIMENTAL is true
 */
export const generatePegInAddress = async (
  claimPubkey: Buffer,
  network: Network = 'mainnet'
): Promise<{ mainchainAddress: string; claimScript: Buffer }> => {
  if (LIQUID_PEGIN_EXPERIMENTAL) {
    throw new Error(
      '[Liquid] Peg-in address generation is EXPERIMENTAL. ' +
      'Federation API or GDK integration is required. ' +
      'Do NOT use a manually constructed peg-in address — funds may be unrecoverable.'
    );
  }

  // TODO: When GDK or federation API is integrated:
  //
  // 1. Fetch federation script from Liquid node or Blockstream API:
  //    const fedScript = await fetchFederationScript(network);
  //
  // 2. Construct claim script:
  //    const claimScript = liquid.script.compile([
  //      liquid.opcodes.OP_0,
  //      liquid.crypto.hash160(claimPubkey),
  //    ]);
  //
  // 3. Derive P2SH address combining federation and claim scripts:
  //    const pegInPayment = liquid.payments.p2sh({
  //      redeem: { output: fedScript, input: claimScript },
  //      network: getLiquidNetwork(network),
  //    });
  //
  // return {
  //   mainchainAddress: pegInPayment.address!,
  //   claimScript,
  // };

  throw new Error('[Liquid] Peg-in path not yet implemented.');
};

// ─── Peg-out (EXPERIMENTAL) ─────────────────────────────────────────────────

/**
 * Creates a Liquid peg-out transaction (L-BTC → BTC).
 * Requires sending L-BTC to the federation's peg-out address with an OP_RETURN
 * containing the desired Bitcoin address.
 *
 * EXPERIMENTAL: Not yet implemented.
 */
export const createPegOutTransaction = async (
  _btcDestAddress: string,
  _amountSats: number,
  _network: Network = 'mainnet'
): Promise<void> => {
  throw new Error(
    '[Liquid] Peg-out is EXPERIMENTAL. ' +
    'Requires PSET construction with federation peg-out output. Not yet implemented.'
  );
};
