import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact } from './value-operation-adapter-test-helpers';
import { getLightningBackend, LdkNodeBackend } from '../services/lightning-backend';
import { createLightningInvoicePaymentArtifact, createLnurlPaymentArtifact } from '../services/lightning';

const DIGEST_A = '44'.repeat(32);
const DIGEST_B = '55'.repeat(32);

function sampleInvoiceArtifact() {
  return createLightningInvoicePaymentArtifact({
    invoice: 'lnbc1-test-invoice-digest-bound',
    network: 'mainnet',
    amountMsat: '50000',
    maxFeeMsat: '1000',
    providerIdentity: 'breez',
    providerConfigurationDigest: DIGEST_A,
    idempotencyDigest: DIGEST_B,
  });
}

function sampleLnurlArtifact() {
  return createLnurlPaymentArtifact({
    lnurl: 'https://pay.example.com/lnurl',
    network: 'mainnet',
    amountMsat: '25000',
    maxFeeMsat: '500',
    providerIdentity: 'lnd',
    providerConfigurationDigest: DIGEST_A,
    idempotencyDigest: DIGEST_B,
    params: {
      callback: 'https://pay.example.com/callback',
      minSendable: 1000,
      maxSendable: 100000,
      metadata: '[["text/plain","test"]]',
    },
  });
}

describe('LdkNodeBackend & Lightning Backend Provider', () => {
  it('returns UnsupportedBackend when config is None or missing', () => {
    const backendNone = getLightningBackend({ type: 'None' });
    expect(backendNone.configured).toBe(false);

    const backendUndefined = getLightningBackend();
    expect(backendUndefined.configured).toBe(false);
  });

  it('instantiates LdkNodeBackend for configured LND or Greenlight or Breez', () => {
    const lndBackend = getLightningBackend({ type: 'LND', endpoint: 'https://lnd.example.com:10009', apiKey: 'admin-macaroon' });
    expect(lndBackend).toBeInstanceOf(LdkNodeBackend);
    expect(lndBackend.configured).toBe(true);

    const breezBackend = getLightningBackend({ type: 'Breez' });
    expect(breezBackend).toBeInstanceOf(LdkNodeBackend);
    expect(breezBackend.configured).toBe(true);

    const greenlightBackend = getLightningBackend({ type: 'Greenlight' });
    expect(greenlightBackend).toBeInstanceOf(LdkNodeBackend);
    expect(greenlightBackend.configured).toBe(true);
  });

  it('delegates to payLightningInvoice / payLnurl in non-production mode', async () => {
    const backend = getLightningBackend({ type: 'Breez' });
    const invoiceArt = sampleInvoiceArtifact();
    const invoiceAuth = await authorizeAdapterArtifact(invoiceArt);

    const invoiceResult = await backend.payInvoice({ authorization: invoiceAuth, artifact: invoiceArt });
    expect(invoiceResult).toMatchObject({ kind: 'unsupported' });

    const lnurlArt = sampleLnurlArtifact();
    const lnurlAuth = await authorizeAdapterArtifact(lnurlArt);

    const lnurlResult = await backend.lnurlPay({ authorization: lnurlAuth, artifact: lnurlArt });
    expect(lnurlResult).toMatchObject({ kind: 'unsupported' });
  });

  it('enforces fail-closed behavior in production environment mode', async () => {
    const backend = getLightningBackend({ type: 'Breez' });
    const invoiceArt = sampleInvoiceArtifact();
    const invoiceAuth = await authorizeAdapterArtifact(invoiceArt);

    await expect(
      backend.payInvoice({ authorization: invoiceAuth, artifact: invoiceArt }, true)
    ).rejects.toThrow(/Guard: Production path for 'LDK Node Backend Invoice Payment' is not yet enabled/);

    const lnurlArt = sampleLnurlArtifact();
    const lnurlAuth = await authorizeAdapterArtifact(lnurlArt);

    await expect(
      backend.lnurlPay({ authorization: lnurlAuth, artifact: lnurlArt }, true)
    ).rejects.toThrow(/Guard: Production path for 'LDK Node Backend LNURL Payment' is not yet enabled/);
  });
});
