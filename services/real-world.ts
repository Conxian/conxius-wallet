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
    void amount;
    void currency;
    void senderCurrency;
    throw new Error('MERCHANT_INVOICE_QUARANTINED: provider payment address is not bound to App-private settlement authority');
}
