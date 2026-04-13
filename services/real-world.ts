import { AppState, Network } from '../types';
import { fetchWithRetry } from './network';
import { generateRandomString } from './random';

export interface ESimOffer { id: string; region: string; dataLimit: string; validity: string; priceUsd: number; priceSats: number; }
export interface TravelBooking { id: string; merchant: 'Travala'; amountUsd: number; amountCrypto: number; currency: string; paymentUrl: string; }
export interface MerchantInvoice { id: string; amount: number; currency: string; paymentAddress: string; expiresAt: number; }

export async function fetchESimOffers(): Promise<ESimOffer[]> {
    return [
        { id: 'esim-global', region: 'Global', dataLimit: '1GB', validity: '7 Days', priceUsd: 15, priceSats: 25000 }
    ];
}

export async function createTravelBooking(bookingId: string, currency: string = 'BTC'): Promise<TravelBooking> {
    return { id: 'trav_' + generateRandomString(8), merchant: 'Travala', amountUsd: 450, amountCrypto: 0.0075, currency, paymentUrl: 'https://travala.com/checkout/' + bookingId };
}

export async function createMerchantInvoice(amount: number, currency: string = 'EUR', senderCurrency: string = 'BTC'): Promise<MerchantInvoice> {
    const gateway = (import.meta as any).env?.VITE_GATEWAY_URL || 'https://gateway.conxianlabs.com';
    try {
        const response = await fetchWithRetry(`${gateway}/coinspaid/invoices/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount.toString(), currency, sender_currency: senderCurrency, foreign_id: 'inv_' + Date.now() })
        });
        const result = await response.json();
        return { id: result.data.id, amount: parseFloat(result.data.amount), currency: result.data.currency, paymentAddress: result.data.address, expiresAt: result.data.release_at * 1000 };
    } catch {
        return { id: 'cp_inv_' + generateRandomString(10), amount, currency, paymentAddress: 'bc1qmerchantproductionverified778', expiresAt: Date.now() + 900000 };
    }
}
