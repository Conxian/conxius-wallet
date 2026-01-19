import { Capacitor, registerPlugin } from '@capacitor/core';

type LdkStatus = {
  configured: boolean;
  balance?: number;
  maxAllowToPay?: number;
  maxAllowToReceive?: number;
  onChainBalance?: number;
};

type CreateInvoiceResult = { paymentRequest: string };
type PayInvoiceResult = { paymentPreimage?: string };

type LdkPlugin = {
  getStatus(): Promise<LdkStatus>;
  createInvoice(options: { amountSats: number; description?: string }): Promise<CreateInvoiceResult>;
  payInvoice(options: { paymentRequest: string }): Promise<PayInvoiceResult>;
  lnurlPay(options: { callback: string; amountMsat: number; comment?: string }): Promise<{ status: string }>;
  lnurlWithdraw(options: { callback: string; k1: string; invoice: string }): Promise<{ status: string }>;
};

declare global {
  interface Window {
    LDK?: {
      getStatus: () => Promise<LdkStatus>;
      createInvoice: (opts: { amountSats: number; description?: string }) => Promise<CreateInvoiceResult>;
      payInvoice: (opts: { paymentRequest: string }) => Promise<PayInvoiceResult>;
      lnurlPay: (opts: { callback: string; amountMsat: number; comment?: string }) => Promise<{ status: string }>;
      lnurlWithdraw: (opts: { callback: string; k1: string; invoice: string }) => Promise<{ status: string }>;
    };
  }
}

const NativeLdk = registerPlugin<LdkPlugin>('Ldk');

export function ensureLdkBridge() {
  if (window.LDK) return;
  if (!Capacitor.isNativePlatform()) return;

  window.LDK = {
    getStatus: () => NativeLdk.getStatus(),
    createInvoice: (opts) => NativeLdk.createInvoice(opts),
    payInvoice: (opts) => NativeLdk.payInvoice(opts),
    lnurlPay: (opts) => NativeLdk.lnurlPay(opts),
    lnurlWithdraw: (opts) => NativeLdk.lnurlWithdraw(opts)
  };
}

ensureLdkBridge();

