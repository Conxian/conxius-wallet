import { afterEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { createMerchantInvoice, fetchESimOffers } from '../services/real-world';

const MAINNET_ADDRESS = bitcoin.payments.p2wpkh({
    hash: Buffer.alloc(20, 1), network: bitcoin.networks.bitcoin,
}).address!;

afterEach(() => vi.restoreAllMocks());

describe('real-world read-only integrations', () => {
    it('keeps eSIM offers informational', async () => {
        const offers = await fetchESimOffers();
        expect(offers).toEqual([expect.objectContaining({ id: 'esim-global', region: 'Global' })]);
    });

    it('returns a validated provider payment instruction without claiming submission or settlement', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
            data: {
                id: 'cp-real-123', amount: '50', currency: 'EUR', sender_currency: 'BTC', network: 'mainnet',
                address: MAINNET_ADDRESS, release_at: Math.floor(Date.now() / 1000) + 900,
            },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

        const result = await createMerchantInvoice(50, 'EUR', 'BTC', {
            gatewayUrl: 'https://gateway.example', network: 'mainnet',
        });
        expect(result).toEqual({
            kind: 'created',
            instruction: {
                kind: 'merchant-payment-instruction', provider: 'coinspaid', providerInvoiceId: 'cp-real-123',
                amount: '50', currency: 'EUR', senderCurrency: 'BTC', network: 'mainnet', paymentAddress: MAINNET_ADDRESS,
                expiresAtUnixMs: expect.any(Number), status: 'created-not-submitted', settlementStatus: 'not-paid-or-settled',
            },
        });
        expect(result.kind === 'created' && result.instruction.status).toBe('created-not-submitted');
        expect(result.kind === 'created' && result.instruction.settlementStatus).toBe('not-paid-or-settled');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://gateway.example/coinspaid/invoices/create',
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('returns unsupported with no request when provider configuration is missing', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        await expect(createMerchantInvoice(50, 'EUR', 'BTC', { gatewayUrl: '' }))
            .resolves.toEqual({ kind: 'unsupported', reason: 'provider_not_configured' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('never fabricates an invoice or address after ambiguous provider failure', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('timed out', 'AbortError'));
        const result = await createMerchantInvoice(50, 'EUR', 'BTC', { gatewayUrl: 'https://gateway.example' });
        expect(result).toEqual({ kind: 'indeterminate', reason: 'provider_request_ambiguous' });
        expect(result).not.toHaveProperty('instruction');
        expect(JSON.stringify(result)).not.toMatch(/bc1|cp_inv|invoiceId|paymentAddress/);
    });

    it.each([
        ['missing id', { amount: '50', currency: 'EUR', sender_currency: 'BTC', network: 'mainnet', address: MAINNET_ADDRESS, release_at: Math.floor(Date.now() / 1000) + 900 }],
        ['wrong network', { id: 'cp-real', amount: '50', currency: 'EUR', sender_currency: 'BTC', network: 'testnet', address: MAINNET_ADDRESS, release_at: Math.floor(Date.now() / 1000) + 900 }],
        ['invalid address', { id: 'cp-real', amount: '50', currency: 'EUR', sender_currency: 'BTC', network: 'mainnet', address: 'bc1q_merchant_prod', release_at: Math.floor(Date.now() / 1000) + 900 }],
        ['expired instruction', { id: 'cp-real', amount: '50', currency: 'EUR', sender_currency: 'BTC', network: 'mainnet', address: MAINNET_ADDRESS, release_at: 1 }],
    ])('rejects malformed provider response: %s', async (_name, data) => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200 }));
        const result = await createMerchantInvoice(50, 'EUR', 'BTC', { gatewayUrl: 'https://gateway.example' });
        expect(result).toEqual({ kind: 'rejected', reason: 'malformed_provider_response' });
        expect(result).not.toHaveProperty('instruction');
    });
});
