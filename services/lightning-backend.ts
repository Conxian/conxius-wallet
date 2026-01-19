import { LnBackendConfig } from '../types';

export interface LightningBackend {
  configured: boolean;
  createInvoice(amountSats: number, memo?: string): Promise<{ invoice: string }>;
  payInvoice(invoice: string): Promise<{ preimage?: string }>;
  lnurlPay(callback: string, amountMsat: number, comment?: string): Promise<{ status: string }>;
  lnurlWithdraw(callback: string, k1: string, invoice: string): Promise<{ status: string }>;
}

class NoneBackend implements LightningBackend {
  configured = false;
  async createInvoice(_amountSats: number, _memo?: string): Promise<{ invoice: string }> {
    throw new Error('Lightning backend not configured');
  }
  async payInvoice(_invoice: string): Promise<{ preimage?: string }> {
    throw new Error('Lightning backend not configured');
  }
  async lnurlPay(_callback: string, _amountMsat: number, _comment?: string): Promise<{ status: string }> {
    throw new Error('Lightning backend not configured');
  }
  async lnurlWithdraw(_callback: string, _k1: string, _invoice: string): Promise<{ status: string }> {
    throw new Error('Lightning backend not configured');
  }
}

class LndBackend implements LightningBackend {
  configured = true;
  host: string;
  macaroon: string;
  constructor(host: string, macaroon: string) {
    this.host = host;
    this.macaroon = macaroon;
  }
  async createInvoice(amountSats: number, memo?: string) {
    const url = `https://${this.host}/v1/invoices`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Grpc-Metadata-macaroon': this.macaroon
      },
      body: JSON.stringify({ value: amountSats, memo: memo || 'Conxius' })
    });
    const data = await res.json();
    return { invoice: data.payment_request };
  }
  async payInvoice(invoice: string) {
    const url = `https://${this.host}/v1/channels/transactions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Grpc-Metadata-macaroon': this.macaroon
      },
      body: JSON.stringify({ payment_request: invoice })
    });
    const data = await res.json();
    return { preimage: data.payment_preimage };
  }
  async lnurlPay(callback: string, amountMsat: number, comment?: string) {
    const cb = new URL(callback);
    cb.searchParams.set('amount', `${amountMsat}`);
    if (comment) cb.searchParams.set('comment', comment);
    const res = await fetch(cb.toString());
    const data = await res.json();
    if (!data.pr) throw new Error('LNURL callback missing invoice');
    await this.payInvoice(data.pr);
    return { status: 'paid' };
  }
  async lnurlWithdraw(callback: string, k1: string, invoice: string) {
    const url = new URL(callback);
    url.searchParams.set('k1', k1);
    url.searchParams.set('pr', invoice);
    const res = await fetch(url.toString());
    const data = await res.json();
    return { status: data.status || 'ok' };
  }
}

class LdkBackend implements LightningBackend {
  configured = true;
  async createInvoice(amountSats: number, memo?: string) {
    const ldk: any = (window as any).LDK;
    if (!ldk) throw new Error('LDK not available');
    const inv = await ldk.createInvoice({ amountSats, description: memo || 'Conxius' });
    return { invoice: inv.paymentRequest };
  }
  async payInvoice(invoice: string) {
    const ldk: any = (window as any).LDK;
    if (!ldk) throw new Error('LDK not available');
    const res = await ldk.payInvoice({ paymentRequest: invoice });
    return { preimage: res.paymentPreimage };
  }
  async lnurlPay(callback: string, amountMsat: number, comment?: string) {
    const ldk: any = (window as any).LDK;
    if (!ldk) throw new Error('LDK not available');
    await ldk.lnurlPay({ callback, amountMsat, comment });
    return { status: 'paid' };
  }
  async lnurlWithdraw(callback: string, k1: string, invoice: string) {
    const ldk: any = (window as any).LDK;
    if (!ldk) throw new Error('LDK not available');
    const res = await ldk.lnurlWithdraw({ callback, k1, invoice });
    return { status: res.status || 'ok' };
  }
}

export function getLightningBackend(cfg?: LnBackendConfig): LightningBackend {
  if (!cfg || cfg.type === 'None') return new NoneBackend();
  if (cfg.type === 'LND' && cfg.endpoint && cfg.apiKey) {
    return new LndBackend(cfg.endpoint, cfg.apiKey);
  }
  return new NoneBackend();
}
