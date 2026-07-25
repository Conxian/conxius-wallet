import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import { createMavenTransfer, createMavenTransferArtifact, fetchMavenAssets } from '../services/maven';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
beforeEach(() => { fetchMock.mockReset(); vi.clearAllMocks(); });

describe('Maven service', () => {
    it('preserves read-only asset discovery', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ assets: [{ id: 'mav1', name: 'Maven', symbol: 'MAV', balance: 1, valueUsd: 10 }] }) });
        expect(await fetchMavenAssets('bc1qtest')).toHaveLength(1);
    });

    it('returns unsupported for an exact transfer without fetching', async () => {
        const artifact = createMavenTransferArtifact({
            assetId: 'mav1', amount: '10', recipient: 'maven:recipient', authorityCommitment: 'authority-commitment',
        });
        fetchMock.mockReset();
        const outcome = await createMavenTransfer({ authorization: await authorizeAdapterArtifact(artifact), artifact });
        expect(outcome).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(JSON.stringify(outcome)).not.toContain('authority-commitment');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects mismatched and forged requests', async () => {
        const artifact = createMavenTransferArtifact({ assetId: 'mav1', amount: '10', recipient: 'maven:r', authorityCommitment: 'commitment' });
        const authorization = await authorizeAdapterArtifact(artifact);
        await expect(createMavenTransfer({ authorization, artifact: { ...artifact, amount: '11' } }))
            .resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
        await expect(createMavenTransfer({ authorization: forgedAuthorization(), artifact }))
            .resolves.toMatchObject({ kind: 'rejected' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
