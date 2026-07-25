import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import {
    createStateChainTransferArtifact,
    createStateChainWithdrawalArtifact,
    transferStateChainUtxo,
    withdrawStateChainUtxo,
} from '../services/statechain';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
beforeEach(() => { fetchMock.mockReset(); vi.clearAllMocks(); });

describe('StateChain gate-bound production adapters', () => {
    it('returns unsupported for exact transfer and withdrawal artifacts with no fetch', async () => {
        const transfer = createStateChainTransferArtifact({ utxoId: 'sc:utxo-1', recipientPubkey: '03newowner', currentIndex: 0 });
        const withdrawal = createStateChainWithdrawalArtifact({
            utxoId: 'sc:utxo-1', destination: 'bc1qdestination', currentIndex: 0, withdrawalCommitment: 'unsigned-withdrawal-commitment',
        });
        await expect(transferStateChainUtxo({ authorization: await authorizeAdapterArtifact(transfer), artifact: transfer }))
            .resolves.toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        const outcome = await withdrawStateChainUtxo({ authorization: await authorizeAdapterArtifact(withdrawal), artifact: withdrawal });
        expect(outcome).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(JSON.stringify(outcome)).not.toContain('unsigned-withdrawal-commitment');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects mismatched and forged requests', async () => {
        const artifact = createStateChainTransferArtifact({ utxoId: 'sc:utxo-1', recipientPubkey: '03newowner', currentIndex: 0 });
        const authorization = await authorizeAdapterArtifact(artifact);
        await expect(transferStateChainUtxo({ authorization, artifact: { ...artifact, currentIndex: '1' } }))
            .resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
        await expect(transferStateChainUtxo({ authorization: forgedAuthorization(), artifact }))
            .resolves.toMatchObject({ kind: 'rejected' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
