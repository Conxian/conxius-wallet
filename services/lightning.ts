import { bech32 } from 'bech32';
import bolt11 from 'light-bolt11-decoder';
import { Buffer } from 'buffer';
import { fetchWithRetry } from './network';
import type { Network } from '../types';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import { knownUnsupportedValueOperation, type AuthorizedValueOperationExecution, type ValueOperationExecutionOutcome } from './value-operation-result';

/**
 * Lightning Service
 * Unified interface for BOLT11 and LNURL.
* Read-only parsing remains available; payment execution is gate-contained.
 */

export type LnurlPayParams = {
  callback: string;
  maxSendable: number;
  minSendable: number;
  metadata: string;
  commentAllowed?: number;
};

export type LnurlWithdrawParams = {
  callback: string;
  k1: string;
  maxWithdrawable: number;
  defaultDescription: string;
};

export function isLnurl(input: string) {
  return input.startsWith('lnurl1') || input.toLowerCase().startsWith('lightning:lnurl1') || input.startsWith('https://') || input.startsWith('http://');
}

export function decodeLnurl(input: string) {
  const lnurl = input.startsWith('lightning:') ? input.slice(10) : input;
  if (lnurl.startsWith('lnurl1')) {
    const { words } = bech32.decode(lnurl, 2048);
    const bytes = bech32.fromWords(words);
    return Buffer.from(bytes).toString('utf8');
  }
  return lnurl;
}

export async function fetchLnurlParams(url: string): Promise<LnurlPayParams | LnurlWithdrawParams> {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error('LNURL fetch failed');
  return await res.json();
}

export function decodeBolt11(invoice: string) {
  try {
    const decoded: any = bolt11.decode(invoice);
    const amountMsat = decoded.sections?.find((s: any) => s.name === 'amount')?.value || null;
    const payee = decoded.payeeNodeKey || decoded.payeeNode || null;
    const description = decoded.sections?.find((s: any) => s.name === 'description')?.value || null;
    const paymentHash = decoded.sections?.find((s: any) => s.name === 'payment_hash')?.value || null;
    const expiry = decoded.expiry || 3600;

    return {
        valid: true,
        amountMsat,
        payee,
        description,
        expiry,
        timestamp: decoded.timestamp,
        paymentHash,
    };
  } catch {
    return { valid: false };
  }
}

export interface LightningInvoicePaymentArtifact extends CanonicalObject {
  readonly kind: 'conxius.wallet.lightning-invoice-payment.v1'; readonly operation: 'pay-lightning-invoice'; readonly chain: 'bitcoin'; readonly layer: 'lightning'; readonly network: Network;
  readonly invoiceDigest: string; readonly paymentHash: string; readonly payee: string; readonly invoiceExpiry: string; readonly amountMsat: string; readonly maxFeeMsat: string;
  readonly providerIdentity: string; readonly providerConfigurationDigest: string; readonly idempotencyDigest: string;
}
export interface LnurlPaymentArtifact extends CanonicalObject {
  readonly kind: 'conxius.wallet.lnurl-payment.v1'; readonly operation: 'pay-lnurl'; readonly chain: 'bitcoin'; readonly layer: 'lightning'; readonly network: Network;
  readonly lnurlDigest: string; readonly callbackDigest: string; readonly metadataDigest: string; readonly amountMsat: string; readonly minSendableMsat: string;
  readonly maxSendableMsat: string; readonly maxFeeMsat: string; readonly providerIdentity: string; readonly providerConfigurationDigest: string; readonly idempotencyDigest: string;
}
export type LightningInvoicePaymentRequest = AuthorizedValueOperationExecution<LightningInvoicePaymentArtifact>;
export type LnurlPaymentRequest = AuthorizedValueOperationExecution<LnurlPaymentArtifact>;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
const canonicalUnsigned = (value: string, field: string): string => { if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`Invalid Lightning ${field}.`); return value; };
const required = (value: string, field: string): string => { const normalized = value.trim(); if (!normalized) throw new Error(`Invalid Lightning ${field}.`); return normalized; };
const digest = (value: string, field: string): string => { const normalized = value.toLowerCase(); if (!HEX_DIGEST.test(normalized)) throw new Error(`Invalid Lightning ${field} digest.`); return normalized; };
const digestText = (kind: string, value: string): string => digestCanonicalPayload(Object.freeze({ kind, value }));

export function createLightningInvoicePaymentArtifact(fields: { invoice: string; network: Network; amountMsat: string; maxFeeMsat: string; providerIdentity: string; providerConfigurationDigest: string; idempotencyDigest: string }): LightningInvoicePaymentArtifact {
  const invoice = required(fields.invoice, 'invoice');
  const decoded = decodeBolt11(invoice) as { valid: boolean; paymentHash?: unknown; payee?: unknown; expiry?: unknown; timestamp?: unknown };
  const invoiceExpiry = decoded.valid && Number.isSafeInteger(decoded.expiry) && Number.isSafeInteger(decoded.timestamp) ? String(Number(decoded.timestamp) + Number(decoded.expiry)) : '0';
  return Object.freeze({
    kind: 'conxius.wallet.lightning-invoice-payment.v1', operation: 'pay-lightning-invoice', chain: 'bitcoin', layer: 'lightning', network: fields.network,
    invoiceDigest: digestText('conxius.wallet.bolt11.v1', invoice), paymentHash: decoded.valid && typeof decoded.paymentHash === 'string' ? decoded.paymentHash : '',
    payee: decoded.valid && typeof decoded.payee === 'string' ? decoded.payee : '', invoiceExpiry, amountMsat: canonicalUnsigned(fields.amountMsat, 'amount'),
    maxFeeMsat: canonicalUnsigned(fields.maxFeeMsat, 'maximum fee'), providerIdentity: required(fields.providerIdentity, 'provider identity'),
    providerConfigurationDigest: digest(fields.providerConfigurationDigest, 'provider configuration'), idempotencyDigest: digest(fields.idempotencyDigest, 'idempotency'),
  });
}
export function createLnurlPaymentArtifact(fields: { lnurl: string; params: LnurlPayParams; network: Network; amountMsat: string; maxFeeMsat: string; providerIdentity: string; providerConfigurationDigest: string; idempotencyDigest: string }): LnurlPaymentArtifact {
  return Object.freeze({
    kind: 'conxius.wallet.lnurl-payment.v1', operation: 'pay-lnurl', chain: 'bitcoin', layer: 'lightning', network: fields.network,
    lnurlDigest: digestText('conxius.wallet.lnurl.v1', required(fields.lnurl, 'LNURL')), callbackDigest: digestText('conxius.wallet.lnurl-callback.v1', required(fields.params.callback, 'LNURL callback')),
    metadataDigest: digestText('conxius.wallet.lnurl-metadata.v1', fields.params.metadata), amountMsat: canonicalUnsigned(fields.amountMsat, 'amount'),
    minSendableMsat: canonicalUnsigned(String(fields.params.minSendable), 'minimum amount'), maxSendableMsat: canonicalUnsigned(String(fields.params.maxSendable), 'maximum amount'),
    maxFeeMsat: canonicalUnsigned(fields.maxFeeMsat, 'maximum fee'), providerIdentity: required(fields.providerIdentity, 'provider identity'),
    providerConfigurationDigest: digest(fields.providerConfigurationDigest, 'provider configuration'), idempotencyDigest: digest(fields.idempotencyDigest, 'idempotency'),
  });
}
/** A preimage is never returned without qualified receipt and payment-hash evidence. */
export async function payLightningInvoice(request: LightningInvoicePaymentRequest): Promise<ValueOperationExecutionOutcome> {
  return knownUnsupportedValueOperation(request, { artifactKind: 'conxius.wallet.lightning-invoice-payment.v1', operationType: 'pay-lightning-invoice', layer: 'lightning', chain: 'bitcoin' });
}
export async function payLnurl(request: LnurlPaymentRequest): Promise<ValueOperationExecutionOutcome> {
  return knownUnsupportedValueOperation(request, { artifactKind: 'conxius.wallet.lnurl-payment.v1', operationType: 'pay-lnurl', layer: 'lightning', chain: 'bitcoin' });
}

/**
 * SRL-1: Lightning Payment State Machine
 */
export type LightningPaymentState =
  | 'INTENT_ACCEPTED'
  | 'POLICY_VALIDATED'
  | 'ROUTE_FEASIBLE'
  | 'LIQUIDITY_RESERVED'
  | 'EXECUTION_IN_FLIGHT'
  | 'SETTLED'
  | 'FAILED_CLOSED'
  | 'EXPIRED';

/**
 * SRL-7: Failure Taxonomy
 */
export type LightningFailureClass = 'PERMANENT' | 'TRANSIENT' | 'INDETERMINATE';

/**
 * Validates state transition according to SRL-1 invariants.
 * Prevents illegal moves like SETTLED -> FAILED_CLOSED.
 */
export function isValidPaymentTransition(current: LightningPaymentState, next: LightningPaymentState): boolean {
  const terminalStates: LightningPaymentState[] = ['SETTLED', 'FAILED_CLOSED', 'EXPIRED'];
  if (terminalStates.includes(current)) return false;

  if (current === next) return false; // Strict transitions

  const stateOrder: LightningPaymentState[] = [
    'INTENT_ACCEPTED',
    'POLICY_VALIDATED',
    'ROUTE_FEASIBLE',
    'LIQUIDITY_RESERVED',
    'EXECUTION_IN_FLIGHT',
    'SETTLED'
  ];

  const currentIndex = stateOrder.indexOf(current);
  const nextIndex = stateOrder.indexOf(next);

  if (next === 'FAILED_CLOSED' || next === 'EXPIRED') return true;
  if (currentIndex === -1 || nextIndex === -1) return false;

  // Only allow moving forward in the order
  return nextIndex > currentIndex;
}

/**
 * SRL-7: Failure Classification Helper
 */
export function classifyLightningError(error: any): LightningFailureClass {
  const msg = error?.message?.toLowerCase() || '';
  // Permanent failures: protocol violations, expired invoices, bad data.
  if (msg.includes('invalid') || msg.includes('expired') || msg.includes('no route') || msg.includes('policy')) {
    return 'PERMANENT';
  }
  // Transient failures: temporary network or peer issues.
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('temporary')) {
    return 'TRANSIENT';
  }
  // Indeterminate: Unknown status, requires manual/auto reconciliation.
  return 'INDETERMINATE';
}
