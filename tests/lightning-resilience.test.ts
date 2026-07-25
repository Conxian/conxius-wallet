import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import { consumeAuthorizedValueOperationStage } from '../services/value-operations';
import {
  classifyLightningError, createLightningInvoicePaymentArtifact, createLnurlPaymentArtifact,
  isValidPaymentTransition, payLightningInvoice, payLnurl,
} from '../services/lightning';
import { getLightningBackend } from '../services/lightning-backend';

const DIGEST_A = '44'.repeat(32); const DIGEST_B = '55'.repeat(32);
function invoiceArtifact() {
  return createLightningInvoicePaymentArtifact({
    invoice: 'lnbc1-invalid-but-digest-bound', network: 'mainnet', amountMsat: '21000', maxFeeMsat: '1000', providerIdentity: 'breez',
    providerConfigurationDigest: DIGEST_A, idempotencyDigest: DIGEST_B,
  });
}
function lnurlArtifact() {
  return createLnurlPaymentArtifact({
    lnurl: 'https://pay.example/.well-known/lnurlp/alice', network: 'mainnet', amountMsat: '21000', maxFeeMsat: '1000',
    providerIdentity: 'lnd', providerConfigurationDigest: DIGEST_A, idempotencyDigest: DIGEST_B,
    params: { callback: 'https://pay.example/callback', minSendable: 1000, maxSendable: 100000, metadata: '[["text/plain","test"]]' },
  });
}

describe('Lightning gate-bound execution', () => {
  it('returns unsupported without native execution or consuming a stage', async () => {
    const artifact = invoiceArtifact(); const authorization = await authorizeAdapterArtifact(artifact);
    const result = await payLightningInvoice({ authorization, artifact });
    expect(result).toMatchObject({ kind: 'unsupported' }); expect(typeof result).not.toBe('string');
    expect(JSON.stringify(result)).not.toMatch(/preimage|invoice/i);
    expect(consumeAuthorizedValueOperationStage(authorization, 'broadcast', authorization.envelopeDigest)).toMatchObject({ kind: 'consumed' });
  });

  it('binds invoice, amount, route metadata, and authorization exactly', async () => {
    const artifact = invoiceArtifact(); const authorization = await authorizeAdapterArtifact(artifact);
    await expect(payLightningInvoice({ authorization, artifact: { ...artifact, amountMsat: '22000' } })).resolves.toMatchObject({ kind: 'rejected' });
    await expect(payLightningInvoice({ authorization: forgedAuthorization(), artifact })).resolves.toMatchObject({ kind: 'rejected' });
    await expect(payLightningInvoice({ artifact } as never)).resolves.toMatchObject({ kind: 'rejected' });
  });

  it('contains direct and backend LNURL/LND/Breez payment paths before fetch or state mutation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const artifact = lnurlArtifact(); const authorization = await authorizeAdapterArtifact(artifact); const request = { authorization, artifact };
    await expect(payLnurl(request)).resolves.toMatchObject({ kind: 'unsupported' });
    await expect(getLightningBackend({ type: 'LND', endpoint: 'node.test', apiKey: 'secret' }).lnurlPay(request)).resolves.toMatchObject({ kind: 'unsupported' });
    const invoice = invoiceArtifact(); const invoiceAuthorization = await authorizeAdapterArtifact(invoice);
    await expect(getLightningBackend({ type: 'Breez' }).payInvoice({ authorization: invoiceAuthorization, artifact: invoice })).resolves.toMatchObject({ kind: 'unsupported' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Lightning non-authoritative helpers', () => {
  it('keeps state validation and failure classification descriptive only', () => {
    expect(isValidPaymentTransition('INTENT_ACCEPTED', 'EXECUTION_IN_FLIGHT')).toBe(true);
    expect(isValidPaymentTransition('SETTLED', 'FAILED_CLOSED')).toBe(false);
    expect(classifyLightningError(new Error('Invoice expired'))).toBe('PERMANENT');
    expect(classifyLightningError(new Error('Unknown generic error'))).toBe('INDETERMINATE');
  });
});
