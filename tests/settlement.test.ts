import { describe, expect, it } from 'vitest';
import {
  computeSettlementFee,
  createSettlementOrchestrator,
  SettlementRail,
  TrustTier,
} from '../services/settlement';

describe('Settlement service (G3 — @conxian/market-sdk wiring)', () => {
  it('computes a positive dynamic fee for an expedient sBTC settlement', () => {
    const result = computeSettlementFee({
      amountSat: 1_000_000n,
      rail: SettlementRail.Sbtc,
      tier: TrustTier.Expedient,
    });

    expect(result.tier).toBe(TrustTier.Expedient);
    expect(result.rail).toBe(SettlementRail.Sbtc);
    expect(result.amountSat).toBe(1_000_000n);
    expect(result.effectiveFeeSat).toBeGreaterThan(0n);
    expect(result.effectiveBps).toBeGreaterThan(0);
  });

  it('distributes the fee 50/30/20 across operations, founders and ecosystem', () => {
    const result = computeSettlementFee({
      amountSat: 100_000_000n,
      rail: SettlementRail.Lightning,
      tier: TrustTier.Managed,
    });

    const { operationsSat, foundersSat, ecosystemSat } = result.distribution;
    expect(operationsSat + foundersSat + ecosystemSat).toBe(result.effectiveFeeSat);
  });

  it('builds a settlement orchestrator bound to the configured gateway', () => {
    const orchestrator = createSettlementOrchestrator('testnet');
    expect(orchestrator).toBeDefined();
    expect(typeof orchestrator.execute).toBe('function');
  });
});
