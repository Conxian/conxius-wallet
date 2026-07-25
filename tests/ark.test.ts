import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import {
    createArkForfeitArtifact,
    createArkRedeemArtifact,
    createLiftPsbt,
    forfeitVtxo,
    redeemVtxo,
    type VTXO,
} from '../services/ark';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
const vtxo: VTXO = {
    txid: '11'.repeat(32), vout: 0, amount: 100000, ownerPubkey: 'owner-key', serverPubkey: 'server-key',
    roundTxid: '22'.repeat(32), expiryHeight: 900000, status: 'available',
};

beforeEach(() => { fetchMock.mockReset(); vi.clearAllMocks(); });

describe('Ark gate-bound production adapters', () => {
    it('returns unsupported for exact forfeit and redeem artifacts without fetching or synthetic success', async () => {
        const forfeitArtifact = createArkForfeitArtifact(vtxo, 'bc1qrecipient', 'mainnet');
        const redeemArtifact = createArkRedeemArtifact(vtxo, 'mainnet');
        const forfeit = await forfeitVtxo({ authorization: await authorizeAdapterArtifact(forfeitArtifact), artifact: forfeitArtifact });
        const redeem = await redeemVtxo({ authorization: await authorizeAdapterArtifact(redeemArtifact), artifact: redeemArtifact });
        expect(forfeit).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(redeem).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(JSON.stringify([forfeit, redeem])).not.toContain(vtxo.txid);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects mismatched and forged requests', async () => {
        const artifact = createArkForfeitArtifact(vtxo, 'bc1qrecipient', 'mainnet');
        const authorization = await authorizeAdapterArtifact(artifact);
        await expect(forfeitVtxo({ authorization, artifact: { ...artifact, recipient: 'bc1qswapped' } }))
            .resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
        await expect(forfeitVtxo({ authorization: forgedAuthorization(), artifact }))
            .resolves.toMatchObject({ kind: 'rejected' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not fabricate a boarding address when ASP data is unavailable', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        await expect(createLiftPsbt({ amountSats: 1000, senderAddress: 'bc1qsender', senderPubkey: '02aa', network: 'mainnet' }))
            .resolves.toEqual({ kind: 'unsupported', reason: 'qualified_asp_boarding_data_unavailable' });
    });
});
