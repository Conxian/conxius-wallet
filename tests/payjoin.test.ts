import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import { createPayJoinArtifact, PayJoinService } from '../services/payjoin';
import { consumeAuthorizedValueOperationStage } from '../services/value-operations';

function artifact(proposedPsbt = 'cHNidP8BAHECAAAA') {
    return createPayJoinArtifact({
        originalPsbt: 'cHNidP8BAHEBAAAA', proposedPsbt, network: 'testnet', endpoint: 'https://payjoin.example/pj#ignored',
        outputs: [
            { scriptOrAddress: 'tb1qrecipient', amountSats: '5000', role: 'recipient' },
            { scriptOrAddress: 'tb1qrefund', amountSats: '4000', role: 'refund' },
        ],
        amountSats: '5000', maximumFeeContributionSats: '100', maximumFeeRateSatPerVbyte: '5',
        recipient: 'tb1qrecipient', refundDestination: 'tb1qrefund',
    });
}

describe('PayJoin execution containment', () => {
    it('builds deterministic exact proposal bindings', () => {
        expect(artifact()).toEqual(artifact());
        expect(artifact().originalPsbtDigest).toMatch(/^[0-9a-f]{64}$/);
        expect(artifact().proposedPsbtDigest).not.toBe(artifact('cHNidP8BAHECAABB').proposedPsbtDigest);
    });

    it('returns unsupported before fetch, signing callbacks, broadcast, or stage consumption', async () => {
        const exact = artifact();
        const authorization = await authorizeAdapterArtifact(exact);
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        await expect(new PayJoinService('testnet').sendPayJoin({ authorization, artifact: exact }))
            .resolves.toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(consumeAuthorizedValueOperationStage(authorization, 'sign', authorization.envelopeDigest))
            .toMatchObject({ kind: 'consumed' });
    });

    it('rejects forged authorization and a swapped proposal', async () => {
        const exact = artifact();
        const authorization = await authorizeAdapterArtifact(exact);
        const service = new PayJoinService('testnet');
        await expect(service.sendPayJoin({ authorization: forgedAuthorization(), artifact: exact })).resolves.toMatchObject({ kind: 'rejected' });
        await expect(service.sendPayJoin({ authorization, artifact: artifact('cHNidP8BAHECAABB') }))
            .resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
    });
});
