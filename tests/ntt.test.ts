import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import { consumeAuthorizedValueOperationStage } from '../services/value-operations';
import { digestCanonicalPayload } from '../services/value-operation-gate';

const sdk = vi.hoisted(() => ({ wormhole: vi.fn(), initiateTransfer: vi.fn(), signer: vi.fn() }));
vi.mock('@wormhole-foundation/sdk-evm', () => ({ EvmPlatform: class {} }));
vi.mock('@wormhole-foundation/sdk', () => ({
  wormhole: sdk.wormhole,
  TokenTransfer: { from: vi.fn(), quoteTransfer: vi.fn() },
}));
import { createNttTransferArtifact, NttService } from '../services/ntt';
import { TrustTier } from '../services/trust-policy';

const DIGEST_A = '11'.repeat(32); const DIGEST_B = '22'.repeat(32); const DIGEST_C = '33'.repeat(32);
function artifact() {
  return createNttTransferArtifact({
    network: 'mainnet', sourceChain: 'Ethereum', destinationChain: 'Base', asset: 'sBTC', amountBaseUnits: '100000000',
    recipient: '0xrecipient', signerIdentity: 'wallet-evm-key', route: 'Ethereum>sBTC-NTT>Base', trustTier: TrustTier.T3,
    providerConfigurationDigest: DIGEST_A, quoteDigest: DIGEST_B, expiry: '2000000000', maxFeeBaseUnits: '10000', idempotencyDigest: DIGEST_C,
  });
}

describe('NTT gate-bound execution', () => {
  it('returns digest-only unsupported without SDK, signer, storage, or stage consumption', async () => {
    const exact = artifact(); const authorization = await authorizeAdapterArtifact(exact);
    const result = await NttService.executeNtt({ authorization, artifact: exact });
    expect(result).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
    expect(typeof result).toBe('object'); expect(JSON.stringify(result)).not.toContain('0xrecipient');
    expect(sdk.wormhole).not.toHaveBeenCalled(); expect(sdk.initiateTransfer).not.toHaveBeenCalled(); expect(sdk.signer).not.toHaveBeenCalled();
    expect(consumeAuthorizedValueOperationStage(authorization, 'sign', authorization.envelopeDigest)).toMatchObject({ kind: 'consumed' });
  });

  it('rejects forged, missing, and changed route/amount bindings', async () => {
    const exact = artifact(); const authorization = await authorizeAdapterArtifact(exact);
    expect(exact.amountBaseUnits).toBe('100000000');
    expect(digestCanonicalPayload({ ...exact, amountBaseUnits: '2' })).not.toBe(digestCanonicalPayload(exact));
    await expect(NttService.executeNtt({ authorization: forgedAuthorization(), artifact: exact })).resolves.toMatchObject({ kind: 'rejected' });
    await expect(NttService.executeNtt({ artifact: exact } as never)).resolves.toMatchObject({ kind: 'rejected' });
    await expect(NttService.executeNtt({ authorization, artifact: { ...exact, amountBaseUnits: '2' } })).resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
    await expect(NttService.executeNtt({ authorization, artifact: { ...exact, route: 'changed' } })).resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
  });

  it('preserves route trust validation as artifact preparation policy', () => {
    expect(() => createNttTransferArtifact({ ...artifact(), trustTier: TrustTier.T1 } as never)).toThrow('Guard: T1 (Sovereign) requires IBC light-client paths');
  });
});
