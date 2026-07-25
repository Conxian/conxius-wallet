import { describe, expect, it } from 'vitest';
import { createNttTransferArtifact, getRecommendedBridgeProtocol } from '../services/ntt';
import { TrustTier } from '../services/trust-policy';

const fields = { network: 'mainnet', sourceChain: 'Ethereum', destinationChain: 'Base', asset: 'sBTC', amountBaseUnits: '1', recipient: 'recipient', signerIdentity: 'key', route: 'route', providerConfigurationDigest: '11'.repeat(32), quoteDigest: '22'.repeat(32), expiry: '1', maxFeeBaseUnits: '1', idempotencyDigest: '33'.repeat(32) } as const;
describe('Trust Policy Integration', () => {
  it('rejects non-compliant NTT artifact routes before authorization', () => {
    expect(() => createNttTransferArtifact({ ...fields, trustTier: TrustTier.T1 })).toThrow('Guard: T1 (Sovereign) requires IBC light-client paths');
    expect(() => createNttTransferArtifact({ ...fields, trustTier: TrustTier.T2, hardenedRoute: false })).toThrow('Guard: T2 (Hybrid) requires hardened configuration');
  });
  it('keeps read-only protocol recommendations', () => {
    expect(getRecommendedBridgeProtocol('Ethereum', 'Base', TrustTier.T1)).toBe('None');
    expect(getRecommendedBridgeProtocol('Ethereum', 'Base', TrustTier.T3)).toBe('NTT');
    expect(getRecommendedBridgeProtocol('Mainnet', 'Stacks', TrustTier.T1)).toBe('Native');
  });
});
