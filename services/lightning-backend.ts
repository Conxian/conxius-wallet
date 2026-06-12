import { LnBackendConfig } from '../types';
import {
  isValidPaymentTransition,
  LightningPaymentIntent,
  checkIdempotency,
  savePaymentIntent,
  classifyLightningError,
  LightningPaymentState
} from './lightning';
import { createLnInvoice, payLnInvoice } from "./breez";

export interface LightningBackend {
  configured: boolean;
  createInvoice(amountSats: number, memo?: string): Promise<{ invoice: string }>;
  payInvoice(invoice: string, idempotencyKey?: string, fingerprint?: string): Promise<{ preimage?: string, state?: LightningPaymentState }>;
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
  async payInvoice(invoice: string) {
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

class BreezBackend implements LightningBackend {
  configured = true;

  async createInvoice(amountSats: number, memo?: string) {
    const { bolt11 } = await createLnInvoice(
      amountSats * 1000,
      memo || "Conxius",
    );
    return { invoice: bolt11 };
  }

  /**
   * SRL-2 & SRL-7: Durable Payment Execution
   */
  async payInvoice(invoice: string, idempotencyKey?: string, fingerprint?: string): Promise<{ preimage?: string, state?: LightningPaymentState }> {
    let intent: LightningPaymentIntent | null = null;

    // Resolve existing intent if possible
    if (idempotencyKey) {
      intent = checkIdempotency(idempotencyKey, fingerprint || "fp_default");
      if (intent) {
        // If terminal, return outcome
        if (intent.state === 'SETTLED' || intent.state === 'FAILED_CLOSED' || intent.state === 'EXPIRED') {
          return { preimage: intent.terminalOutcome?.preimage, state: intent.state };
        }
        // If already in flight, prevent concurrent execution (SRL-2 Bug Fix)
        if (intent.state === 'EXECUTION_IN_FLIGHT') {
          throw new Error('Payment already in flight');
        }
      }
    }

    if (!intent) {
      // Improved default key with random suffix to avoid theoretical millisecond collisions
      const defaultKey = "ik_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      intent = {
        id: "pay_" + Math.random().toString(36).substr(2, 9),
        idempotencyKey: idempotencyKey || defaultKey,
        fingerprint: fingerprint || "fp_default",
        state: 'INTENT_ACCEPTED',
        attemptNo: 1,
        occurredAt: Date.now()
      };
      savePaymentIntent(intent);
    }

    const maxAttempts = 3;
    while (intent.attemptNo <= maxAttempts) {
      try {
        // Transition to IN_FLIGHT if valid
        if (isValidPaymentTransition(intent.state, 'EXECUTION_IN_FLIGHT')) {
           intent.state = 'EXECUTION_IN_FLIGHT';
           savePaymentIntent(intent);
        } else if (intent.state !== 'EXECUTION_IN_FLIGHT') {
           throw new Error(`Illegal state transition from ${intent.state} to EXECUTION_IN_FLIGHT`);
        }

        const res = await payLnInvoice(invoice);

        intent.state = 'SETTLED';
        intent.terminalOutcome = { preimage: res.paymentHash };
        savePaymentIntent(intent);

        return { preimage: res.paymentHash, state: 'SETTLED' };
      } catch (error: any) {
        const failureClass = classifyLightningError(error);
        intent.failureClass = failureClass;

        if (failureClass === 'PERMANENT' || intent.attemptNo >= maxAttempts) {
          intent.state = 'FAILED_CLOSED';
          intent.reasonCode = error.message || 'UNKNOWN_FAILURE';
          savePaymentIntent(intent);
          throw error;
        }

        // TRANSIENT retry logic (SRL-7)
        intent.attemptNo++;
        // Reset state to accept retry attempt
        intent.state = 'INTENT_ACCEPTED';
        savePaymentIntent(intent);

        // Exponential backoff with jitter
        const delay = Math.pow(2, intent.attemptNo) * 100 + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    intent.state = 'FAILED_CLOSED';
    savePaymentIntent(intent);
    throw new Error('Payment failed after maximum retries');
  }

  async lnurlPay(callback: string, amountMsat: number, comment?: string) {
    const cb = new URL(callback);
    cb.searchParams.set("amount", `${amountMsat}`);
    if (comment) cb.searchParams.set("comment", comment);
    const res = await fetch(cb.toString());
    const data = await res.json();
    if (!data.pr) throw new Error("LNURL callback missing invoice");
    await this.payInvoice(data.pr);
    return { status: "paid" };
  }

  async lnurlWithdraw(callback: string, k1: string, invoice: string) {
    const url = new URL(callback);
    url.searchParams.set("k1", k1);
    url.searchParams.set("pr", invoice);
    const res = await fetch(url.toString());
    const data = await res.json();
    return { status: data.status || "ok" };
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
