// @ts-nocheck -- Wormhole SDK read-only status APIs expose incompatible multi-version declarations.
import { sha256 } from '@noble/hashes/sha2.js';
import { TokenTransfer, wormhole } from '@wormhole-foundation/sdk';
import { EvmPlatform } from '@wormhole-foundation/sdk-evm';
import type { AppState, Network } from '../types';
import { calculateNttFee } from './monetization';
import { endpointsFor } from './network';
import { fetchBtcPrice } from './protocol';
import { BridgeSystem, TrustTier, validateRouteTrust } from './trust-policy';
import type { CanonicalObject } from './value-operation-gate';
import { knownUnsupportedValueOperation, type AuthorizedValueOperationExecution, type ValueOperationExecutionOutcome } from './value-operation-result';

export const NTT_CONFIGS = {
  sBTC: { symbol: 'sBTC', decimals: 8, tokenIds: { Bitcoin: 'native', Stacks: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sbtc-token', Ethereum: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', Base: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', Arbitrum: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' } },
  W: { symbol: 'W', decimals: 18, tokenIds: { Solana: '85VBFQZC9TZkfAd9S1UZ6WqZBBH6YXM3u2v5n88ZpLp3', Ethereum: '0xB66E0F928829C1F82f06b6E8B6D1B2A10D597A2E', Base: '0xB66E0F928829C1F82f06b6E8B6D1B2A10D597A2E' } },
} as const;
export interface FeeEstimation { wormholeBridgeFee: number; destinationNetworkFee: number; integratorFee: number; totalFee: number; }
export interface NttTransferArtifact extends CanonicalObject {
  readonly kind: 'conxius.wallet.ntt-transfer.v1'; readonly operation: 'initiate-ntt-transfer'; readonly chain: 'wormhole'; readonly layer: 'ntt'; readonly network: Network;
  readonly sourceChain: string; readonly destinationChain: string; readonly asset: string; readonly amountBaseUnits: string; readonly recipient: string;
  readonly signerIdentity: string; readonly route: string; readonly trustTier: TrustTier; readonly hardenedRoute: boolean;
  readonly providerConfigurationDigest: string; readonly quoteDigest: string; readonly expiry: string; readonly maxFeeBaseUnits: string; readonly idempotencyDigest: string;
}
export type NttTransferRequest = AuthorizedValueOperationExecution<NttTransferArtifact>;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
function required(value: string, field: string): string { const normalized = value.trim(); if (!normalized) throw new Error(`Invalid NTT ${field}.`); return normalized; }
function canonicalUnsigned(value: string, field: string): string { if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`Invalid NTT ${field}.`); return value; }
function digest(value: string, field: string): string { const normalized = value.toLowerCase(); if (!HEX_DIGEST.test(normalized)) throw new Error(`Invalid NTT ${field} digest.`); return normalized; }

export function createNttTransferArtifact(fields: {
  network: Network; sourceChain: string; destinationChain: string; asset: string; amountBaseUnits: string; recipient: string; signerIdentity: string;
  route: string; trustTier?: TrustTier; hardenedRoute?: boolean; providerConfigurationDigest: string; quoteDigest: string; expiry: string;
  maxFeeBaseUnits: string; idempotencyDigest: string;
}): NttTransferArtifact {
  const trustTier = fields.trustTier ?? TrustTier.T3; const hardenedRoute = fields.hardenedRoute ?? false;
  const sourceChain = required(fields.sourceChain, 'source chain'); const destinationChain = required(fields.destinationChain, 'destination chain');
  const validation = validateRouteTrust({ system: BridgeSystem.WORMHOLE_NTT, sourceChain, targetChain: destinationChain, trustTier, isHardened: hardenedRoute });
  if (!validation.allowed) throw new Error(`Guard: ${validation.reason}`);
  return Object.freeze({
    kind: 'conxius.wallet.ntt-transfer.v1', operation: 'initiate-ntt-transfer', chain: 'wormhole', layer: 'ntt', network: fields.network,
    sourceChain, destinationChain, asset: required(fields.asset, 'asset'), amountBaseUnits: canonicalUnsigned(fields.amountBaseUnits, 'amount'),
    recipient: required(fields.recipient, 'recipient'), signerIdentity: required(fields.signerIdentity, 'signer identity'), route: required(fields.route, 'route'),
    trustTier, hardenedRoute, providerConfigurationDigest: digest(fields.providerConfigurationDigest, 'provider configuration'), quoteDigest: digest(fields.quoteDigest, 'quote'),
    expiry: canonicalUnsigned(fields.expiry, 'expiry'), maxFeeBaseUnits: canonicalUnsigned(fields.maxFeeBaseUnits, 'maximum fee'), idempotencyDigest: digest(fields.idempotencyDigest, 'idempotency'),
  });
}

const getWormholeContext = async (network: Network, appState?: AppState) => {
  const rpcs = appState ? endpointsFor(network, appState) : null; const config: { chains: Record<string, { rpc: string }> } = { chains: {} };
  if (rpcs?.BTC_API) config.chains.Bitcoin = { rpc: rpcs.BTC_API }; if (rpcs?.STX_API) config.chains.Stacks = { rpc: rpcs.STX_API };
  return wormhole(network === 'mainnet' ? 'Mainnet' : 'Testnet', [EvmPlatform], config);
};
export class NttManager { static async getOutboundLimit(chain: string): Promise<bigint> { void chain; return 1000000000n; } static hashStacksPrincipal(principal: string): Uint8Array { return sha256(new TextEncoder().encode(principal)); } }
export class NttService {
  static async estimateFees(amount: string, source: string, target: string, network: Network): Promise<FeeEstimation> {
    void source; void target; void network;
    try { const integratorFee = calculateNttFee(Number.parseFloat(amount) || 0, await fetchBtcPrice()); return { wormholeBridgeFee: 0.00001, destinationNetworkFee: 0.00005, integratorFee, totalFee: 0.00006 + integratorFee }; }
    catch { return { wormholeBridgeFee: 0.0001, destinationNetworkFee: 0.00005, integratorFee: 0, totalFee: 0.00015 }; }
  }
  /** Source submission is unsupported; this is not VAA, redemption, or settlement evidence. */
  static async executeNtt(request: NttTransferRequest): Promise<ValueOperationExecutionOutcome> {
    return knownUnsupportedValueOperation(request, { artifactKind: 'conxius.wallet.ntt-transfer.v1', operationType: 'initiate-ntt-transfer', layer: 'ntt', chain: 'wormhole' });
  }
  /** Read-only observation. A status is not settlement evidence. */
  static async trackProgress(txHash: string, network: Network, appState?: AppState): Promise<{ status: string; signatures: number }> {
    try { const status = await (await getWormholeContext(network, appState)).getTransactionStatus(txHash); return { status: status.state || 'Pending', signatures: (status as { vaa?: { signatures?: unknown[] } }).vaa?.signatures?.length || 0 }; }
    catch { return { status: 'Unknown', signatures: 0 }; }
  }
  /** Read-only attestation retrieval. A VAA is neither destination redemption nor settlement. */
  static async fetchVaa(txHash: string, network: Network, appState?: AppState): Promise<Uint8Array | null> {
    try { const xfer = await TokenTransfer.from(await getWormholeContext(network, appState), txHash); const attestations = await xfer.fetchAttestation(60000); return (attestations[0] as { vaa: Uint8Array }).vaa; }
    catch { return null; }
  }
  static async discoverPublicNttTokens(network: Network): Promise<unknown[]> { const baseUrl = network === 'mainnet' ? 'https://api.wormholescan.io' : 'https://api.testnet.wormholescan.io'; try { const response = await fetch(`${baseUrl}/api/v1/ntt/tokens`); return response.ok ? response.json() : []; } catch { return []; } }
}
export const BRIDGE_STAGES = [
  { id: 'CONFIRMATION', text: 'Source Confirmation', userMessage: 'Awaiting source-chain evidence...' },
  { id: 'VAA', text: 'Wormhole VAA', userMessage: 'Awaiting an attestation...' },
  { id: 'REDEMPTION', text: 'Redemption', userMessage: 'Awaiting destination redemption evidence...' },
];
export const getRecommendedBridgeProtocol = (source: string, target: string, requiredTier: TrustTier = TrustTier.T3): 'Native' | 'NTT' | 'Swap' | 'None' => {
  const bitcoinEcosystem = ['Stacks', 'Liquid', 'Rootstock', 'BOB', 'B2', 'Botanix', 'Mezo', 'RGB', 'Ark', 'StateChain', 'Lightning'];
  if (source === 'Mainnet' && bitcoinEcosystem.includes(target)) return 'Native';
  if ((source === 'Mainnet' && (target === 'Lightning' || target === 'Liquid')) || (source === 'Liquid' && target === 'Mainnet')) return 'Swap';
  return validateRouteTrust({ system: BridgeSystem.WORMHOLE_NTT, sourceChain: source, targetChain: target, trustTier: requiredTier, isHardened: false }).allowed ? 'NTT' : 'None';
};
