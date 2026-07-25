import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import { createTaprootAssetTransferArtifact, discoverTaprootAssets, transferTaprootAsset } from '../services/taproot-assets';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('Taproot Assets service', () => {
    it('preserves read-only discovery', async () => {
        expect(await discoverTaprootAssets()).toEqual([]);
    });

    it('returns unsupported for an exact transfer with no side effects', async () => {
        const artifact = createTaprootAssetTransferArtifact({
            assetId: 'tap:123', amount: 100n, recipient: 'taproot:recipient', virtualTransactionCommitment: 'virtual-tx-commitment',
        });
        const outcome = await transferTaprootAsset({ authorization: await authorizeAdapterArtifact(artifact), artifact });
        expect(outcome).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(JSON.stringify(outcome)).not.toContain('virtual-tx-commitment');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects mismatched and forged requests', async () => {
        const artifact = createTaprootAssetTransferArtifact({ assetId: 'tap:123', amount: '100', recipient: 'tap:r', virtualTransactionCommitment: 'commitment' });
        const authorization = await authorizeAdapterArtifact(artifact);
        await expect(transferTaprootAsset({ authorization, artifact: { ...artifact, amount: '101' } }))
            .resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
        await expect(transferTaprootAsset({ authorization: forgedAuthorization(), artifact }))
            .resolves.toMatchObject({ kind: 'rejected' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
