import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import {
    createRgbIssuanceArtifact,
    createRgbTransfer,
    createRgbTransferArtifact,
    issueRgbAsset,
    validateConsignment,
    verifyRgbProofWasm,
} from '../services/rgb';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
beforeEach(() => { fetchMock.mockReset(); vi.clearAllMocks(); });

describe('RGB gate-bound production adapters', () => {
    it('returns unsupported for exact issuance and transfer artifacts', async () => {
        const issuance = createRgbIssuanceArtifact({
            name: 'Test Token', symbol: 'TST', totalSupply: '1000', precision: 8, schema: 'RGB20', initialSeal: `${'aa'.repeat(32)}:0`,
        });
        const transfer = createRgbTransferArtifact({
            assetId: 'rgb:asset', amount: '100', beneficiary: 'blind:recipient', transitionCommitment: 'transition-commitment',
        });
        await expect(issueRgbAsset({ authorization: await authorizeAdapterArtifact(issuance), artifact: issuance }))
            .resolves.toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        const outcome = await createRgbTransfer({ authorization: await authorizeAdapterArtifact(transfer), artifact: transfer });
        expect(outcome).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(JSON.stringify(outcome)).not.toContain('transition-commitment');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects mismatched and forged transfer requests', async () => {
        const artifact = createRgbTransferArtifact({ assetId: 'rgb:asset', amount: '100', beneficiary: 'blind:a', transitionCommitment: 'commitment' });
        const authorization = await authorizeAdapterArtifact(artifact);
        await expect(createRgbTransfer({ authorization, artifact: { ...artifact, amount: '101' } }))
            .resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
        await expect(createRgbTransfer({ authorization: forgedAuthorization(), artifact }))
            .resolves.toMatchObject({ kind: 'rejected' });
    });

    it('fails closed when authoritative WASM validation is unavailable', async () => {
        expect(await verifyRgbProofWasm('aa'.repeat(64))).toBe(false);
        expect(await validateConsignment({ id: 'cons:1', assetId: 'rgb:asset', vouts: [0], witness: 'aa'.repeat(64), endpoints: [] }))
            .toBe(false);
        expect(await validateConsignment(null as never)).toBe(false);
    });
});
