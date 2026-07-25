import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import { consumeAuthorizedValueOperationStage } from '../services/value-operations';
import { ConxiusWormholeSigner, createWormholeBatchSigningArtifact, executeWormholeBatchSigning, WormholeSigningUnavailableError } from '../services/wormhole-signer';

function artifact() { return createWormholeBatchSigningArtifact({ network: 'mainnet', sourceChain: 'Ethereum', destinationChain: 'Base', signerIdentity: 'evm-key', providerConfigurationDigest: '11'.repeat(32), transactions: [{ transactionDigest: '22'.repeat(32), chainId: '1', nonce: '7', route: 'Ethereum>Base' }] }); }
describe('Wormhole signer containment', () => {
  it('returns unsupported without invoking an opaque signer callback or consuming a stage', async () => {
    const callback = vi.fn(); const exact = artifact(); const authorization = await authorizeAdapterArtifact(exact);
    const result = await executeWormholeBatchSigning({ authorization, artifact: exact });
    expect(result).toMatchObject({ kind: 'unsupported' }); expect(result).not.toBeInstanceOf(Array); expect(callback).not.toHaveBeenCalled();
    expect(consumeAuthorizedValueOperationStage(authorization, 'sign', authorization.envelopeDigest)).toMatchObject({ kind: 'consumed' });
  });
  it('rejects forged and changed ordered transaction batches', async () => {
    const exact = artifact(); const authorization = await authorizeAdapterArtifact(exact);
    await expect(executeWormholeBatchSigning({ authorization: forgedAuthorization(), artifact: exact })).resolves.toMatchObject({ kind: 'rejected' });
    await expect(executeWormholeBatchSigning({ authorization, artifact: { ...exact, transactions: [{ ...exact.transactions[0], nonce: '8' }] } })).resolves.toMatchObject({ kind: 'rejected' });
  });
  it('uses a typed SDK containment error rather than fabricated signed transactions', async () => {
    const signer = new ConxiusWormholeSigner('Ethereum', '0xabc');
    await expect(signer.sign([])).rejects.toBeInstanceOf(WormholeSigningUnavailableError);
  });
});
