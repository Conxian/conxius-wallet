import type { LnBackendConfig } from '../types';
import { payLightningInvoice, payLnurl, type LightningInvoicePaymentRequest, type LnurlPaymentRequest } from './lightning';
import { failClosed } from './production-guard';
import type { ValueOperationExecutionOutcome } from './value-operation-result';

export interface LightningBackend {
  readonly configured: boolean;
  payInvoice(request: LightningInvoicePaymentRequest, isProduction?: boolean): Promise<ValueOperationExecutionOutcome>;
  lnurlPay(request: LnurlPaymentRequest, isProduction?: boolean): Promise<ValueOperationExecutionOutcome>;
}

class UnsupportedBackend implements LightningBackend {
  constructor(readonly configured: boolean) {}
  async payInvoice(request: LightningInvoicePaymentRequest): Promise<ValueOperationExecutionOutcome> { return payLightningInvoice(request); }
  async lnurlPay(request: LnurlPaymentRequest): Promise<ValueOperationExecutionOutcome> { return payLnurl(request); }
}

export class LdkNodeBackend implements LightningBackend {
  readonly configured: boolean;

  constructor(private readonly config: LnBackendConfig) {
    this.configured = Boolean(
      config.type !== 'None' &&
      (config.endpoint || config.type === 'Breez' || config.type === 'Greenlight')
    );
  }

  async payInvoice(request: LightningInvoicePaymentRequest, isProduction?: boolean): Promise<ValueOperationExecutionOutcome> {
    if (!this.configured) {
      return payLightningInvoice(request);
    }
    // Fail-closed enforcement in production mode if native LDK Node endpoint is uninitialized
    return failClosed(
      'LDK Node Backend Invoice Payment',
      payLightningInvoice(request),
      isProduction
    );
  }

  async lnurlPay(request: LnurlPaymentRequest, isProduction?: boolean): Promise<ValueOperationExecutionOutcome> {
    if (!this.configured) {
      return payLnurl(request);
    }
    // Fail-closed enforcement in production mode if native LDK Node endpoint is uninitialized
    return failClosed(
      'LDK Node Backend LNURL Payment',
      payLnurl(request),
      isProduction
    );
  }
}

/** Resolves configured Lightning backend engine with LDK Node & fail-closed production runtime guard support. */
export function getLightningBackend(cfg?: LnBackendConfig): LightningBackend {
  if (!cfg || cfg.type === 'None') return new UnsupportedBackend(false);

  const isConfigured = Boolean(
    (cfg.type === 'LND' && Boolean(cfg.endpoint && cfg.apiKey)) ||
    cfg.type === 'Greenlight' ||
    cfg.type === 'Breez' ||
    (cfg.endpoint && cfg.endpoint.trim().length > 0)
  );

  if (isConfigured) {
    return new LdkNodeBackend(cfg);
  }

  return new UnsupportedBackend(false);
}
