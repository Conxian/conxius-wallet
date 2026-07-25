import { LnBackendConfig } from '../types';
import { LightningPaymentState } from './lightning';
import { createLnInvoice } from "./breez";
import {
  consumeValueOperationSettlementAuthorization,
  ValueOperationSettlementAuthorization,
} from './value-operation';

export interface LightningBackend {
  configured: boolean;
  createInvoice(amountSats: number, memo?: string): Promise<{ invoice: string }>;
  payInvoice(invoice: string, authorization: ValueOperationSettlementAuthorization, network: string, idempotencyKey?: string, fingerprint?: string): Promise<{ preimage?: string, state?: LightningPaymentState }>;
  lnurlPay(callback: string, amountMsat: number, authorization: ValueOperationSettlementAuthorization, network: string, comment?: string): Promise<{ status: string }>;
  lnurlWithdraw(callback: string, k1: string, invoice: string, authorization: ValueOperationSettlementAuthorization, network: string): Promise<{ status: string }>;
}

class NoneBackend implements LightningBackend {
  configured = false;
  async createInvoice(_amountSats: number, _memo?: string): Promise<{ invoice: string }> {
    void _amountSats;
    void _memo;
    throw new Error('Lightning backend not configured');
  }
  async payInvoice(_invoice: string, _authorization: ValueOperationSettlementAuthorization, _network: string): Promise<{ preimage?: string }> {
    void _invoice;
    void _authorization;
    void _network;
    throw new Error('Lightning backend not configured');
  }
  async lnurlPay(_callback: string, _amountMsat: number, _authorization: ValueOperationSettlementAuthorization, _network: string, _comment?: string): Promise<{ status: string }> {
    void _callback;
    void _amountMsat;
    void _authorization;
    void _network;
    void _comment;
    throw new Error('Lightning backend not configured');
  }
  async lnurlWithdraw(_callback: string, _k1: string, _invoice: string, _authorization: ValueOperationSettlementAuthorization, _network: string): Promise<{ status: string }> {
    void _callback;
    void _k1;
    void _invoice;
    void _authorization;
    void _network;
    throw new Error('Lightning backend not configured');
  }
}

class LndBackend implements LightningBackend {
  configured = true;
  baseUrl: string;
  macaroon: string;
  constructor(host: string, macaroon: string) {
    const trimmed = host.trim();
    this.baseUrl = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    this.macaroon = macaroon;
  }
  async createInvoice(amountSats: number, memo?: string) {
    const url = new URL('/v1/invoices', this.baseUrl).toString();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Grpc-Metadata-macaroon': this.macaroon
      },
      body: JSON.stringify({ value: amountSats, memo: memo || 'Conxius' })
    });
    if (!res.ok) throw new Error('LND invoice request failed');
    const data = await res.json();
    return { invoice: data.payment_request };
  }
  private async payInvoiceAfterAuthorization(invoice: string) {
    const url = new URL('/v1/channels/transactions', this.baseUrl).toString();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Grpc-Metadata-macaroon': this.macaroon
      },
      body: JSON.stringify({ payment_request: invoice })
    });
    if (!res.ok) throw new Error('LND payment request failed');
    const data = await res.json();
    return { preimage: data.payment_preimage };
  }
  async payInvoice(invoice: string, authorization: ValueOperationSettlementAuthorization, network: string) {
    consumeValueOperationSettlementAuthorization({
      authorization,
      layer: 'Lightning',
      provider: 'lnd-rest',
      network,
      intent: { kind: 'bolt11', invoice },
    });
    return this.payInvoiceAfterAuthorization(invoice);
  }
  async lnurlPay(callback: string, amountMsat: number, authorization: ValueOperationSettlementAuthorization, network: string, comment?: string) {
    consumeValueOperationSettlementAuthorization({
      authorization,
      layer: 'Lightning',
      provider: 'lnd-rest',
      network,
      intent: { kind: 'lnurl-pay', callback, amountMsat, ...(comment ? { comment } : {}) },
    });
    const cb = new URL(callback);
    cb.searchParams.set('amount', `${amountMsat}`);
    if (comment) cb.searchParams.set('comment', comment);
    const res = await fetch(cb.toString());
    const data = await res.json();
    if (!data.pr) throw new Error('LNURL callback missing invoice');
    await this.payInvoiceAfterAuthorization(data.pr);
    return { status: 'paid' };
  }
  async lnurlWithdraw(callback: string, k1: string, invoice: string, authorization: ValueOperationSettlementAuthorization, network: string) {
    consumeValueOperationSettlementAuthorization({
      authorization,
      layer: 'Lightning',
      provider: 'lnd-rest',
      network,
      intent: { kind: 'lnurl-withdraw', callback, k1, invoice },
    });
    const url = new URL(callback);
    url.searchParams.set('k1', k1);
    url.searchParams.set('pr', invoice);
    const res = await fetch(url.toString());
    const data = await res.json();
    return { status: data.status || 'ok' };
  }
}

class BreezBackend implements LightningBackend {
  configured = true;

  async createInvoice(amountSats: number, memo?: string) {
    const { bolt11 } = await createLnInvoice(
      amountSats * 1000,
      memo || "Conxius",
    );
    return { invoice: bolt11 };
  }

  async payInvoice(
    _invoice: string,
    _authorization: ValueOperationSettlementAuthorization,
    _network: string,
    _idempotencyKey?: string,
    _fingerprint?: string,
  ): Promise<{ preimage?: string, state?: LightningPaymentState }> {
    void _invoice;
    void _authorization;
    void _network;
    void _idempotencyKey;
    void _fingerprint;
    throw new Error('BREEZ_BACKEND_SETTLEMENT_QUARANTINED: use the App-authorized Breez settlement boundary');
  }

  async lnurlPay(_callback: string, _amountMsat: number, _authorization: ValueOperationSettlementAuthorization, _network: string, _comment?: string): Promise<{ status: string }> {
    void _callback;
    void _amountMsat;
    void _authorization;
    void _network;
    void _comment;
    throw new Error('BREEZ_BACKEND_LNURL_QUARANTINED: authoritative settlement adapter unavailable');
  }

  async lnurlWithdraw(_callback: string, _k1: string, _invoice: string, _authorization: ValueOperationSettlementAuthorization, _network: string): Promise<{ status: string }> {
    void _callback;
    void _k1;
    void _invoice;
    void _authorization;
    void _network;
    throw new Error('BREEZ_BACKEND_LNURL_QUARANTINED: authoritative settlement adapter unavailable');
  }
}

export function getLightningBackend(cfg?: LnBackendConfig): LightningBackend {
  if (!cfg || cfg.type === 'None') return new NoneBackend();
  if (cfg.type === 'LND' && cfg.endpoint && cfg.apiKey) {
    return new LndBackend(cfg.endpoint, cfg.apiKey);
  }
  if (cfg.type === "Greenlight" || cfg.type === "Breez") {
    return new BreezBackend();
  }
  return new NoneBackend();
}
