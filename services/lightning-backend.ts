import type { LnBackendConfig } from '../types';
import { payLightningInvoice, payLnurl, type LightningInvoicePaymentRequest, type LnurlPaymentRequest } from './lightning';
import type { ValueOperationExecutionOutcome } from './value-operation-result';

export interface LightningBackend {
  readonly configured: boolean;
  payInvoice(request: LightningInvoicePaymentRequest): Promise<ValueOperationExecutionOutcome>;
  lnurlPay(request: LnurlPaymentRequest): Promise<ValueOperationExecutionOutcome>;
}
class UnsupportedBackend implements LightningBackend {
  constructor(readonly configured: boolean) {}
  async payInvoice(request: LightningInvoicePaymentRequest): Promise<ValueOperationExecutionOutcome> { return payLightningInvoice(request); }
  async lnurlPay(request: LnurlPaymentRequest): Promise<ValueOperationExecutionOutcome> { return payLnurl(request); }
}
/** Configuration is descriptive only; LND/Breez cannot fetch, sign, or mutate payment state. */
export function getLightningBackend(cfg?: LnBackendConfig): LightningBackend {
  if (!cfg || cfg.type === 'None') return new UnsupportedBackend(false);
  return new UnsupportedBackend((cfg.type === 'LND' && Boolean(cfg.endpoint && cfg.apiKey)) || cfg.type === 'Greenlight' || cfg.type === 'Breez');
}
