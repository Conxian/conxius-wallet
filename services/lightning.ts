import { Capacitor } from "@capacitor/core";
import { bech32 } from 'bech32';
import bolt11 from 'light-bolt11-decoder';
import { Buffer } from 'buffer';
import { fetchWithRetry } from './network';

/**
 * Lightning Service
 * Unified interface for BOLT11 and LNURL.
 * Integrates with native BreezManager on Android.
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
    const expiry = decoded.expiry || 3600;

    return {
        valid: true,
        amountMsat,
        payee,
        description,
        expiry,
        timestamp: decoded.timestamp
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Native Bridge: Breez SDK Interaction
 */
export async function payLightningInvoice(invoice: string): Promise<string> {
    // @ts-ignore: Android bridge call
    if (Capacitor && Capacitor.Plugins.BreezManager) {
        // @ts-ignore
        return await Capacitor.Plugins.BreezManager.payInvoice({ bolt11: invoice });
    }
    return "mock_preimage_for_unsupported_platform";
}

export async function payLnurl(params: LnurlPayParams | LnurlWithdrawParams, amount: number): Promise<string> {
    return "lnurl_pay_sim_txid_" + Date.now();
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

export interface LightningPaymentIntent {
  id: string;
  idempotencyKey: string;
  fingerprint: string;
  state: LightningPaymentState;
  failureClass?: LightningFailureClass;
  reasonCode?: string;
  attemptNo: number;
  occurredAt: number;
  terminalOutcome?: any;
}

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
 * SRL-2: Idempotency & Conflict Store (Simulation)
 * NOTE: In production, this must be persisted to encrypted local storage (Room/SQLCipher).
 */
const paymentIntentStore = new Map<string, LightningPaymentIntent>();

export function getPaymentIntent(idempotencyKey: string): LightningPaymentIntent | undefined {
  return paymentIntentStore.get(idempotencyKey);
}

export function savePaymentIntent(intent: LightningPaymentIntent): void {
  paymentIntentStore.set(intent.idempotencyKey, intent);
}

/**
 * SRL-2: Idempotency Check with conflict detection.
 * Returns existing intent if fingerprint matches, otherwise throws 409 conflict.
 */
export function checkIdempotency(idempotencyKey: string, fingerprint: string): LightningPaymentIntent | null {
  const existing = getPaymentIntent(idempotencyKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new Error('409 Conflict: Idempotency key already used with different fingerprint');
    }
    return existing;
  }
  return null;
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
