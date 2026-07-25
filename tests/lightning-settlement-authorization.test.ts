import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bech32 } from 'bech32';
import {
  authorizeValueOperationSettlement,
  createValueOperationRequest,
  requireValueOperationSettlementAuthorization,
  ValueOperationEvidenceRequest,
  ValueOperationOutcome,
  ValueOperationRequest,
  ValueOperationSettlementAuthorization,
} from '../services/value-operation';
import { createAppPrivateValueOperationAuthority, resetAppPrivateValueOperationReplayCacheForTests } from '../services/app-private/value-operation-authority';
import { payLightningInvoice, payLnurl, requireBolt11Settlement } from '../services/lightning';
import { getLightningBackend } from '../services/lightning-backend';
import { payLnInvoice, sendBreezOnchain } from '../services/breez';

const mocks = vi.hoisted(() => ({
  nativePayInvoice: vi.fn(),
  breezPay: vi.fn(),
  breezSendOnchain: vi.fn(),
  fetch: vi.fn(),
  requestEnclaveSignature: vi.fn(),
  getWalletEvidenceAdapter: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    Plugins: { BreezManager: { payInvoice: mocks.nativePayInvoice } },
  },
  registerPlugin: () => ({
    pay: mocks.breezPay,
    sendOnchain: mocks.breezSendOnchain,
    start: vi.fn(), nodeInfo: vi.fn(), invoice: vi.fn(), lnurlAuth: vi.fn(), receiveOnchain: vi.fn(), stop: vi.fn(),
  }),
}));
vi.mock('../services/app-private/value-operation-signer', () => ({ signAuthorizedValueOperation: mocks.requestEnclaveSignature }));
vi.mock('../services/value-operation-evidence', () => ({ getWalletEvidenceAdapter: mocks.getWalletEvidenceAdapter }));

const now = new Date('2026-07-25T04:00:00.000Z');
const BOLT11_MAINNET = 'lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567';

function invoiceWithHrp(hrp: string): string {
  return bech32.encode(hrp, bech32.decode(BOLT11_MAINNET, 2048).words, 2048);
}

function request(provider: string, intent: unknown, nonce: string = crypto.randomUUID()): ValueOperationRequest {
  return createValueOperationRequest({
    operationType: 'settle', chainLayer: 'Lightning', payload: { provider, intent }, network: 'mainnet',
    purpose: 'test.lightning-settlement', nonce, audience: 'conxius-wallet',
    keyIdentity: 'wallet.lightning.node', algorithm: 'secp256k1-ecdsa',
    issuedAt: '2026-07-25T03:59:00.000Z', expiresAt: '2026-07-25T04:05:00.000Z',
    signingType: 'message', description: 'Authorize exact Lightning settlement',
  });
}

function verified(value: ValueOperationEvidenceRequest) {
  return {
    status: 'verified' as const, provider: 'test-verifier', providerStatus: 'authoritative' as const,
    requestDigest: value.requestDigest, nonce: value.nonce, audience: value.audience,
    keyIdentity: value.keyIdentity, algorithm: value.algorithm, evidenceDigests: [],
    issuedAt: '2026-07-25T03:59:00.000Z', expiresAt: '2026-07-25T04:05:00.000Z',
  };
}

async function authorize(value: ValueOperationRequest): Promise<ValueOperationSettlementAuthorization> {
  const outcome = await createAppPrivateValueOperationAuthority('vault').confirm(value);
  return requireValueOperationSettlementAuthorization(outcome, value);
}

describe('Lightning settlement authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    resetAppPrivateValueOperationReplayCacheForTests();
    global.fetch = mocks.fetch;
    mocks.getWalletEvidenceAdapter.mockReturnValue({ verify: vi.fn(async (value) => verified(value)) });
    mocks.requestEnclaveSignature.mockResolvedValue({ signature: 'native-signature', pubkey: 'native-pubkey', timestamp: now.getTime() });
    mocks.nativePayInvoice.mockResolvedValue({ paymentHash: 'authoritative-payment-hash' });
    mocks.breezPay.mockResolvedValue({ paymentHash: 'breez-payment-hash', status: 'complete', amountMsat: 1000 });
    mocks.breezSendOnchain.mockResolvedValue({ reverseSwapId: 'authoritative-swap-id' });
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ payment_preimage: 'lnd-preimage' }) });
  });

  it('settles the exact native Breez invoice once', async () => {
    const invoice = BOLT11_MAINNET;
    const amountSats = 2000;
    const authorization = await authorize(request('native-breez-manager', { kind: 'bolt11', invoice, amountSats }));
    await expect(payLightningInvoice(invoice, amountSats, authorization, 'mainnet')).resolves.toBe('authoritative-payment-hash');
    await expect(payLightningInvoice(invoice, amountSats, authorization, 'mainnet')).rejects.toThrow('REPLAYED');
    expect(mocks.nativePayInvoice).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['fabricated', () => ({ kind: 'value-operation-settlement-authorization' } as ValueOperationSettlementAuthorization), BOLT11_MAINNET, 2000, 'mainnet', 'INVALID'],
    ['wrong invoice', null, invoiceWithHrp('lnbc30u'), 3000, 'mainnet', 'INTENT_MISMATCH'],
    ['wrong amount', null, BOLT11_MAINNET, 3000, 'mainnet', 'AMOUNT_MISMATCH'],
    ['wrong network', null, BOLT11_MAINNET, 2000, 'testnet', 'NETWORK_MISMATCH'],
  ])('rejects %s before native I/O', async (_name, makeAuthorization, invoice, amountSats, network, code) => {
    const genuine = await authorize(request('native-breez-manager', { kind: 'bolt11', invoice: BOLT11_MAINNET, amountSats: 2000 }));
    const authorization = makeAuthorization ? makeAuthorization() : genuine;
    await expect(payLightningInvoice(invoice, amountSats, authorization, network as 'mainnet' | 'testnet')).rejects.toThrow(code);
    expect(mocks.nativePayInvoice).not.toHaveBeenCalled();
  });

  it('rejects amountless BOLT11 invoices before authorization consumption or native I/O', async () => {
    const amountless = invoiceWithHrp('lnbc');
    const authorization = await authorize(request('native-breez-manager', { kind: 'bolt11', invoice: amountless, amountSats: 2000 }));

    expect(() => requireBolt11Settlement(amountless, 2000, 'mainnet')).toThrow('BOLT11_AMOUNT_REQUIRED');
    await expect(payLightningInvoice(amountless, 2000, authorization, 'mainnet')).rejects.toThrow('BOLT11_AMOUNT_REQUIRED');
    expect(mocks.nativePayInvoice).not.toHaveBeenCalled();
  });

  it('rejects stale authorization before native I/O', async () => {
    const invoice = BOLT11_MAINNET;
    const authorization = await authorize(request('native-breez-manager', { kind: 'bolt11', invoice, amountSats: 2000 }));
    vi.setSystemTime(new Date(now.getTime() + 61_000));
    await expect(payLightningInvoice(invoice, 2000, authorization, 'mainnet')).rejects.toThrow('STALE');
    expect(mocks.nativePayInvoice).not.toHaveBeenCalled();
  });

  it('rejects provider substitution before native I/O', async () => {
    const invoice = BOLT11_MAINNET;
    const authorization = await authorize(request('lnd-rest', { kind: 'bolt11', invoice, amountSats: 2000 }));
    await expect(payLightningInvoice(invoice, 2000, authorization, 'mainnet')).rejects.toThrow('CONTEXT_MISMATCH');
    expect(mocks.nativePayInvoice).not.toHaveBeenCalled();
  });

  it('consumes exact LNURL intent before the intentionally unsupported adapter boundary', async () => {
    const params = { callback: 'https://lnurl.example/pay', minSendable: 1000, maxSendable: 5000, metadata: '[]' };
    const authorization = await authorize(request('native-breez-manager', { kind: 'lnurl-pay', params, amountSats: 2 }));
    await expect(payLnurl(params, 3, authorization, 'mainnet')).rejects.toThrow('INTENT_MISMATCH');
    await expect(payLnurl(params, 2, authorization, 'mainnet')).rejects.toThrow('LNURL_PAYMENT_UNSUPPORTED');
    await expect(payLnurl(params, 2, authorization, 'mainnet')).rejects.toThrow('REPLAYED');
    expect(mocks.nativePayInvoice).not.toHaveBeenCalled();
  });

  it('rejects denied, quarantined, plain-object, and wrong-request callback outcomes', async () => {
    const exact = request('native-breez-manager', { kind: 'bolt11', invoice: 'lnbc1exact' }, 'exact');
    const wrong = request('native-breez-manager', { kind: 'bolt11', invoice: 'lnbc1wrong' }, 'wrong');
    const wrongOutcome = await createAppPrivateValueOperationAuthority('vault').confirm(wrong);

    await expect(authorizeValueOperationSettlement(async () => wrongOutcome, exact)).rejects.toThrow('REQUEST_MISMATCH');
    await expect(authorizeValueOperationSettlement(async () => ({ status: 'rejected', code: 'NO', reason: 'no' }), exact)).rejects.toThrow('NO');
    await expect(authorizeValueOperationSettlement(async () => ({ status: 'quarantined', code: 'NO_EVIDENCE', reason: 'no' }), exact)).rejects.toThrow('NO_EVIDENCE');
    await expect(authorizeValueOperationSettlement(async () => ({
      status: 'allowed', authorization: { kind: 'value-operation-authorization' },
      settlementAuthorization: { kind: 'value-operation-settlement-authorization' },
    } as ValueOperationOutcome), exact)).rejects.toThrow('not issued');
    expect(mocks.nativePayInvoice).not.toHaveBeenCalled();
  });

  it('binds Breez plugin invoice and on-chain settlement before plugin I/O', async () => {
    const invoice = BOLT11_MAINNET;
    const invoiceAuthorization = await authorize(request('breez-plugin', { kind: 'bolt11', invoice, amountSats: 2000 }));
    await expect(payLnInvoice(invoice, 2000, invoiceAuthorization, 'mainnet')).resolves.toMatchObject({ paymentHash: 'breez-payment-hash' });

    const onchainIntent = { kind: 'breez-onchain', address: 'bc1qexact', amountSats: 50_000, feeRateSatsPerVbyte: 3 };
    const onchainAuthorization = await authorize(request('breez-plugin', onchainIntent));
    await expect(sendBreezOnchain('bc1qwrong', 50_000, 3, onchainAuthorization, 'mainnet')).rejects.toThrow('INTENT_MISMATCH');
    await expect(sendBreezOnchain('bc1qexact', 50_000, 3, onchainAuthorization, 'mainnet')).resolves.toEqual({ reverseSwapId: 'authoritative-swap-id' });
    await expect(sendBreezOnchain('bc1qexact', 50_000, 3, onchainAuthorization, 'mainnet')).rejects.toThrow('REPLAYED');
    expect(mocks.breezPay).toHaveBeenCalledTimes(1);
    expect(mocks.breezSendOnchain).toHaveBeenCalledTimes(1);
  });

  it('preserves the Breez capability when BOLT11 semantics fail before plugin I/O', async () => {
    const invoice = BOLT11_MAINNET;
    const amountless = invoiceWithHrp('lnbc');
    const authorization = await authorize(request('breez-plugin', { kind: 'bolt11', invoice, amountSats: 2000 }));

    await expect(payLnInvoice(amountless, 2000, authorization, 'mainnet')).rejects.toThrow('BOLT11_AMOUNT_REQUIRED');
    expect(mocks.breezPay).not.toHaveBeenCalled();
    await expect(payLnInvoice(invoice, 2000, authorization, 'mainnet')).resolves.toMatchObject({ paymentHash: 'breez-payment-hash' });
    expect(mocks.breezPay).toHaveBeenCalledTimes(1);
  });

  it('binds LND invoice settlement before HTTP I/O', async () => {
    const invoice = BOLT11_MAINNET;
    const backend = getLightningBackend({ type: 'LND', endpoint: 'https://lnd.example', apiKey: 'test-macaroon' });
    const authorization = await authorize(request('lnd-rest', { kind: 'bolt11', invoice, amountSats: 2000 }));
    await expect(backend.payInvoice(invoice, 2000, authorization, 'mainnet')).resolves.toEqual({ preimage: 'lnd-preimage' });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    const wrongAuthorization = await authorize(request('lnd-rest', { kind: 'bolt11', invoice, amountSats: 2000 }));
    await expect(backend.payInvoice(invoiceWithHrp('lnbc30u'), 3000, wrongAuthorization, 'mainnet')).rejects.toThrow('INTENT_MISMATCH');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves the LND capability when BOLT11 semantics fail before HTTP I/O', async () => {
    const invoice = BOLT11_MAINNET;
    const amountless = invoiceWithHrp('lnbc');
    const backend = getLightningBackend({ type: 'LND', endpoint: 'https://lnd.example', apiKey: 'test-macaroon' });
    const authorization = await authorize(request('lnd-rest', { kind: 'bolt11', invoice, amountSats: 2000 }));

    await expect(backend.payInvoice(amountless, 2000, authorization, 'mainnet')).rejects.toThrow('BOLT11_AMOUNT_REQUIRED');
    expect(mocks.fetch).not.toHaveBeenCalled();
    await expect(backend.payInvoice(invoice, 2000, authorization, 'mainnet')).resolves.toEqual({ preimage: 'lnd-preimage' });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('quarantines LND LNURL pay before callback or payment HTTP I/O', async () => {
    const callback = 'https://lnurl.example/pay';
    const backend = getLightningBackend({ type: 'LND', endpoint: 'https://lnd.example', apiKey: 'test-macaroon' });
    const authorization = await authorize(request('lnd-rest', { kind: 'lnurl-pay', callback, amountMsat: 2500 }));

    await expect(backend.lnurlPay(callback, 2000, authorization, 'mainnet')).rejects.toThrow('LND_LNURL_PAY_QUARANTINED');
    expect(mocks.fetch).not.toHaveBeenCalled();

    await expect(backend.lnurlPay(callback, 2500, authorization, 'mainnet')).rejects.toThrow('LND_LNURL_PAY_QUARANTINED');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('binds LND LNURL withdrawal callback, k1, and invoice before HTTP I/O', async () => {
    const callback = 'https://lnurl.example/withdraw';
    const invoice = 'lnbc1withdraw';
    const backend = getLightningBackend({ type: 'LND', endpoint: 'https://lnd.example', apiKey: 'test-macaroon' });
    const authorization = await authorize(request('lnd-rest', { kind: 'lnurl-withdraw', callback, k1: 'exact-k1', invoice }));

    await expect(backend.lnurlWithdraw(callback, 'wrong-k1', invoice, authorization, 'mainnet')).rejects.toThrow('INTENT_MISMATCH');
    expect(mocks.fetch).not.toHaveBeenCalled();

    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'OK' }) });
    await expect(backend.lnurlWithdraw(callback, 'exact-k1', invoice, authorization, 'mainnet')).resolves.toEqual({ status: 'OK' });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps legacy Breez backend invoice and LNURL settlement explicitly quarantined with zero I/O', async () => {
    const backend = getLightningBackend({ type: 'Breez' });
    const fabricated = { kind: 'value-operation-settlement-authorization' } as ValueOperationSettlementAuthorization;
    await expect(backend.payInvoice('lnbc1legacy', 1, fabricated, 'mainnet')).rejects.toThrow('BREEZ_BACKEND_SETTLEMENT_QUARANTINED');
    await expect(backend.lnurlPay('https://lnurl.example/pay', 1000, fabricated, 'mainnet')).rejects.toThrow('BREEZ_BACKEND_LNURL_QUARANTINED');
    await expect(backend.lnurlWithdraw('https://lnurl.example/withdraw', 'k1', 'lnbc1legacy', fabricated, 'mainnet')).rejects.toThrow('BREEZ_BACKEND_LNURL_QUARANTINED');
    expect(mocks.breezPay).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
