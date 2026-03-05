import { describe, it, expect, vi } from 'vitest';
import { fetchESimOffers, createMerchantInvoice } from '../services/real-world';

describe('Real-World Service Integrations', () => {
    it('should fetch eSIM offers from Silent.Link', async () => {
        const offers = await fetchESimOffers();
        expect(offers.length).toBeGreaterThan(0);
        expect(offers[0].region).toBe('Global');
    });

    it('should generate a merchant invoice via CoinsPaid (Mocked)', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    id: 123,
                    amount: '50.00',
                    currency: 'EUR',
                    address: 'bc1q_merchant_address_placeholder',
                    release_at: Math.floor(Date.now() / 1000) + 900
                }
            })
        });

        const invoice = await createMerchantInvoice(50, 'EUR', 'BTC');
        expect(invoice.id).toBe(123);
        expect(invoice.paymentAddress).toBe('bc1q_merchant_address_placeholder');
    });
});
