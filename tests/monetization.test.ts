import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import {
    calculateEffectiveFeeRate,
    calculateNttIntegrationFee,
    createB2bInvoiceAuthorizationArtifact,
    signB2bInvoice,
} from '../services/monetization';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('Monetization logic', () => {
    it('preserves fee calculations', () => {
        const state: any = { sovereigntyScore: 100, loyaltyXP: 0 };
        expect(calculateEffectiveFeeRate(state)).toBeGreaterThanOrEqual(0.001);
        expect(calculateNttIntegrationFee(1000000)).toBe(50);
    });

    it('returns unsupported for an exact deterministic invoice authorization', async () => {
        const artifact = createB2bInvoiceAuthorizationArtifact({
            invoiceId: 'invoice-123', invoiceDigest: 'invoice-digest', merchantIdentity: 'merchant-1', payeeIdentity: 'payee-1',
            amount: '1250.00', currency: 'usd', network: 'mainnet', domain: 'gateway.conxian.example',
            expiresAt: '2026-12-31T23:59:59Z', termsDigest: 'terms-digest',
        });
        const outcome = await signB2bInvoice({ authorization: await authorizeAdapterArtifact(artifact), artifact });
        expect(outcome).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(JSON.stringify(outcome)).not.toContain('invoice-123');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects mismatched and forged invoice requests', async () => {
        const artifact = createB2bInvoiceAuthorizationArtifact({
            invoiceId: 'invoice-123', invoiceDigest: 'digest', merchantIdentity: 'merchant', payeeIdentity: 'payee',
            amount: '10.00', currency: 'USD', network: 'mainnet', domain: 'gateway.example',
        });
        const authorization = await authorizeAdapterArtifact(artifact);
        await expect(signB2bInvoice({ authorization, artifact: { ...artifact, amount: '11.00' } }))
            .resolves.toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
        await expect(signB2bInvoice({ authorization: forgedAuthorization(), artifact }))
            .resolves.toMatchObject({ kind: 'rejected' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
