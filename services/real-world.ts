import * as bitcoin from 'bitcoinjs-lib';
import type { Network } from '../types';
import { fetchWithRetry } from './network';
import { digestCanonicalPayload } from './value-operation-gate';

export interface ESimOffer { id: string; region: string; dataLimit: string; validity: string; priceUsd: number; priceSats: number; }
export interface MerchantPaymentInstruction {
    readonly kind: 'merchant-payment-instruction';
    readonly provider: 'coinspaid';
    readonly providerInvoiceId: string;
    readonly amount: string;
    readonly currency: string;
    readonly senderCurrency: string;
    readonly network: Network;
    readonly paymentAddress: string;
    readonly expiresAtUnixMs: number;
    readonly status: 'created-not-submitted';
    readonly settlementStatus: 'not-paid-or-settled';
}
export type MerchantInvoiceResult =
    | Readonly<{ kind: 'created'; instruction: MerchantPaymentInstruction }>
    | Readonly<{ kind: 'unsupported'; reason: 'provider_not_configured' }>
    | Readonly<{ kind: 'indeterminate'; reason: 'provider_request_ambiguous' }>
    | Readonly<{ kind: 'rejected'; reason: 'invalid_request' | 'provider_rejected' | 'malformed_provider_response' }>;

export async function fetchESimOffers(): Promise<ESimOffer[]> {
    return [{ id: 'esim-global', region: 'Global', dataLimit: '1GB', validity: '7 Days', priceUsd: 15, priceSats: 25000 }];
}

function bitcoinNetwork(network: Network): bitcoin.Network {
    return network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
}

function isValidAddress(address: string, network: Network): boolean {
    try {
        bitcoin.address.toOutputScript(address, bitcoinNetwork(network));
        return true;
    } catch {
        return false;
    }
}

function providerUrl(configuredUrl?: string): string | null {
    const value = configuredUrl ?? (import.meta as any).env?.VITE_GATEWAY_URL;
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:') return null;
        return url.toString().replace(/\/$/, '');
    } catch {
        return null;
    }
}

export async function createMerchantInvoice(
    amount: number,
    currency: string = 'EUR',
    senderCurrency: string = 'BTC',
    options: Readonly<{ gatewayUrl?: string; network?: Network }> = {},
): Promise<MerchantInvoiceResult> {
    const gateway = providerUrl(options.gatewayUrl);
    const network = options.network ?? 'mainnet';
    const normalizedCurrency = currency.trim().toUpperCase();
    const normalizedSenderCurrency = senderCurrency.trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || !normalizedCurrency || !normalizedSenderCurrency) {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_request' });
    }
    if (!gateway) return Object.freeze({ kind: 'unsupported', reason: 'provider_not_configured' });

    const amountString = amount.toString();
    const foreignId = `invoice-request:${digestCanonicalPayload(Object.freeze({
        kind: 'conxius.wallet.merchant-invoice-request.v1', amount: amountString,
        currency: normalizedCurrency, senderCurrency: normalizedSenderCurrency, network,
    }))}`;
    try {
        const response = await fetchWithRetry(`${gateway}/coinspaid/invoices/create`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amountString, currency: normalizedCurrency, sender_currency: normalizedSenderCurrency,
                network, foreign_id: foreignId,
            }),
        }, 0);
        if (!response.ok) return Object.freeze({ kind: 'rejected', reason: 'provider_rejected' });
        const result: unknown = await response.json();
        const data = typeof result === 'object' && result !== null && !Array.isArray(result)
            ? (result as { data?: unknown }).data : null;
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return Object.freeze({ kind: 'rejected', reason: 'malformed_provider_response' });
        }
        const record = data as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        const providerAmount = typeof record.amount === 'string' ? record.amount.trim() : '';
        const providerCurrency = typeof record.currency === 'string' ? record.currency.trim().toUpperCase() : '';
        const providerSenderCurrency = typeof record.sender_currency === 'string' ? record.sender_currency.trim().toUpperCase() : '';
        const providerNetwork = record.network;
        const address = typeof record.address === 'string' ? record.address.trim() : '';
        const releaseAt = record.release_at;
        if (
            !id || !providerAmount || Number(providerAmount) !== amount || providerCurrency !== normalizedCurrency
            || providerSenderCurrency !== normalizedSenderCurrency || providerNetwork !== network
            || !address || !isValidAddress(address, network)
            || !Number.isSafeInteger(releaseAt) || (releaseAt as number) <= Math.floor(Date.now() / 1000)
        ) {
            return Object.freeze({ kind: 'rejected', reason: 'malformed_provider_response' });
        }
        const instruction = Object.freeze({
            kind: 'merchant-payment-instruction' as const, provider: 'coinspaid' as const, providerInvoiceId: id,
            amount: providerAmount, currency: providerCurrency, senderCurrency: providerSenderCurrency,
            network, paymentAddress: address, expiresAtUnixMs: (releaseAt as number) * 1000,
            status: 'created-not-submitted' as const, settlementStatus: 'not-paid-or-settled' as const,
        });
        return Object.freeze({ kind: 'created', instruction });
    } catch {
        return Object.freeze({ kind: 'indeterminate', reason: 'provider_request_ambiguous' });
    }
}
