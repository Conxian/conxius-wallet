import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import {
    acceptDLCOffer,
    createDLCAcceptanceArtifact,
    createDLCOffer,
    createDLCSettlementArtifact,
    settleDLC,
} from '../services/dlc';
import { consumeAuthorizedValueOperationStage } from '../services/value-operations';

function offer() {
    return createDLCOffer({
        oraclePubkey: 'oracle-pubkey', eventDescriptor: 'btc-usd-2027', collateralSats: '100000',
        counterpartyCollateralSats: '100000', expiryUnixSeconds: '1900000000', network: 'testnet',
        outcomes: [{ label: 'above', payoutSats: '200000' }, { label: 'below', payoutSats: '0' }],
    });
}

describe('DLC value-operation containment', () => {
    it('creates only a deterministic unsigned proposal', () => {
        const first = offer();
        expect(first).toEqual(offer());
        expect(first).toMatchObject({ status: 'unsigned-proposal', kind: 'conxius.wallet.dlc-offer-proposal.v1' });
        expect(first.proposalId).toMatch(/^dlc-proposal:[0-9a-f]{64}$/);
        expect(JSON.stringify(first)).not.toMatch(/Accepted|Signed|Broadcasted|Settled|sig1|sig2/);
    });

    it('binds exact offer/CET inputs and returns unsupported without fetch or stage consumption', async () => {
        const artifact = createDLCAcceptanceArtifact({
            offer: offer(), fundingTransactionDigest: '11'.repeat(32),
            cetTemplates: [{ outcome: 'above', transactionDigest: '22'.repeat(32) }],
        });
        const authorization = await authorizeAdapterArtifact(artifact);
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        await expect(acceptDLCOffer({ authorization, artifact }))
            .resolves.toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(consumeAuthorizedValueOperationStage(authorization, 'sign', authorization.envelopeDigest))
            .toMatchObject({ kind: 'consumed' });
    });

    it('rejects forged and swapped DLC acceptance artifacts', async () => {
        const artifact = createDLCAcceptanceArtifact({
            offer: offer(), fundingTransactionDigest: '11'.repeat(32),
            cetTemplates: [{ outcome: 'above', transactionDigest: '22'.repeat(32) }],
        });
        const authorization = await authorizeAdapterArtifact(artifact);
        await expect(acceptDLCOffer({ authorization: forgedAuthorization(), artifact })).resolves.toMatchObject({ kind: 'rejected' });
        await expect(acceptDLCOffer({ authorization, artifact: { ...artifact, cetSetDigest: '33'.repeat(32) } }))
            .resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
    });

    it('binds exact contract/oracle/outcome/CET settlement and never returns a txid', async () => {
        const artifact = createDLCSettlementArtifact({
            contract: { contractId: 'contract-1', offerDigest: '44'.repeat(32) }, offer: offer(),
            oracleAttestation: 'oracle-attestation', outcome: 'above', cetTransactionDigest: '55'.repeat(32),
        });
        const authorization = await authorizeAdapterArtifact(artifact);
        const outcome = await settleDLC({ authorization, artifact });
        expect(outcome).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(JSON.stringify(outcome)).not.toContain('txid');
        expect(consumeAuthorizedValueOperationStage(authorization, 'settle', authorization.envelopeDigest))
            .toMatchObject({ kind: 'consumed' });
    });
});
