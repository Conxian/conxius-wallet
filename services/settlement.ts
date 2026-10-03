/**
 * Settlement Service — wires `@conxian/market-sdk` into the Vault (G3).
 *
 * Routes protocol settlement and dynamic fee calculation through the canonical
 * ADR-004 fee model (`calculateDynamicFee`) and the multi-rail
 * `SettlementOrchestrator`, replacing the ad-hoc integrator-fee helpers in
 * `monetization.ts` as the single source of truth for protocol fees.
 */
import {
  GatewayClient,
  GatewayVerifier,
  SettlementOrchestrator,
  calculateDynamicFee,
  TrustTier,
  SettlementRail,
} from "@conxian/market-sdk";
import type {
  DynamicFeeResult,
  FeeOptions,
  SettlementRequest,
  SettlementResult,
} from "@conxian/market-sdk";
import { getGatewayUrl } from "./network";
import type { Network } from "../types";

export { TrustTier, SettlementRail };

export interface SettlementFeeInput {
  amountSat: bigint;
  rail: SettlementRail;
  tier: TrustTier;
  volumeDecayTier?: FeeOptions["volumeDecayTier"];
  systemLoadFactor?: number;
  enterpriseSubscriptionCap?: boolean;
}

/**
 * Computes the dynamic protocol settlement fee for an amount on a given
 * rail/tier. This is the single fee source of truth (ADR-004) for the Vault.
 */
export function computeSettlementFee(input: SettlementFeeInput): DynamicFeeResult {
  return calculateDynamicFee({
    tier: input.tier,
    rail: input.rail,
    amountSat: input.amountSat,
    volumeDecayTier: input.volumeDecayTier,
    systemLoadFactor: input.systemLoadFactor,
    enterpriseSubscriptionCap: input.enterpriseSubscriptionCap,
  });
}

/**
 * Builds a SettlementOrchestrator bound to the configured gateway.
 */
export function createSettlementOrchestrator(network: Network, apiToken?: string): SettlementOrchestrator {
  const gateway = new GatewayClient({ baseUrl: getGatewayUrl(network), apiToken });
  const verifier = new GatewayVerifier(gateway);
  return new SettlementOrchestrator(gateway, verifier);
}

/**
 * Executes a settlement request through the SDK's multi-rail orchestrator.
 */
export async function settle(
  network: Network,
  request: SettlementRequest,
  apiToken?: string,
): Promise<SettlementResult> {
  const orchestrator = createSettlementOrchestrator(network, apiToken);
  return orchestrator.execute(request);
}
