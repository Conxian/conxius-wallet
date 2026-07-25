import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import { consumeAuthorizedValueOperationStage } from '../services/value-operations';
import { createBoltzSwapArtifact, createChangellyPaymentInstruction, createChangellyPaymentInstructionArtifact, createGasSwapArtifact, executeBoltzSwap, executeGasSwap } from '../services/swap';

const A = '11'.repeat(32); const B = '22'.repeat(32); const C = '33'.repeat(32); const D = '44'.repeat(32);
const common = { network: 'mainnet', quoteDigest: A, providerConfigurationDigest: B, sourceAsset: 'BTC', targetAsset: 'L-BTC', sourceNetwork: 'bitcoin', targetNetwork: 'liquid', amountBaseUnits: '1000', destinationAddress: 'destination', expiry: '2000000000', route: 'bitcoin>liquid', maxFeeBaseUnits: '10', maxSlippageBps: '50', idempotencyDigest: C } as const;
describe('swap execution containment', () => {
  it('contains Boltz before timers, notifications, or provider execution', async () => {
    const timer = vi.spyOn(globalThis, 'setTimeout');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const artifact = createBoltzSwapArtifact({ ...common, invoice: 'lnbc-test', refundAddress: 'refund', htlcArtifactDigest: D });
    const authorization = await authorizeAdapterArtifact(artifact); const result = await executeBoltzSwap({ authorization, artifact });
    expect(result).toMatchObject({ kind: 'unsupported' }); expect(typeof result).not.toBe('string'); expect(timer).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled();
    expect(consumeAuthorizedValueOperationStage(authorization, 'broadcast', authorization.envelopeDigest)).toMatchObject({ kind: 'consumed' });
  });
  it('contains gas swaps and rejects changed amount/route/authorization', async () => {
    const artifact = createGasSwapArtifact({ ...common, providerIdentity: 'LI.FI', depositAddress: 'deposit', unsignedTransactionDigest: D });
    const authorization = await authorizeAdapterArtifact(artifact);
    await expect(executeGasSwap({ authorization, artifact })).resolves.toMatchObject({ kind: 'unsupported' });
    await expect(executeGasSwap({ authorization, artifact: { ...artifact, amountBaseUnits: '1001' } })).resolves.toMatchObject({ kind: 'rejected' });
    await expect(executeGasSwap({ authorization: forgedAuthorization(), artifact })).resolves.toMatchObject({ kind: 'rejected' });
  });
  it('treats Changelly provider output only as an unsupported non-settlement instruction', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const artifact = createChangellyPaymentInstructionArtifact({ ...common, refundAddress: 'refund', quote: { id: 'quote-1', fromAsset: 'BTC', toAsset: 'ETH', fromAmount: 1, toAmount: 20, fee: 0.01, effectiveFeeRate: 0.001, provider: 'Changelly', estimatedTime: 15 } });
    const authorization = await authorizeAdapterArtifact(artifact); const result = await createChangellyPaymentInstruction({ authorization, artifact });
    expect(result).toMatchObject({ kind: 'unsupported' }); expect(JSON.stringify(result)).not.toMatch(/payinAddress|settled|submitted/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
