import { describe, it, expect, vi } from 'vitest';
import { fetchESimOffers, createMerchantInvoice } from '../services/real-world';

describe('Real-World Service Integrations', () => {
    it('should fetch eSIM offers from Silent.Link', async () => {
        const offers = await fetchESimOffers();
        expect(offers.length).toBeGreaterThan(0);
        expect(offers[0].region).toBe('Global');
    });

    it('quarantines merchant invoice creation before provider I/O or synthetic address fallback', async () => {
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

        await expect(createMerchantInvoice(50, 'EUR', 'BTC'))
            .rejects.toThrow('MERCHANT_INVOICE_QUARANTINED');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
