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
    if (window.Capacitor && window.Capacitor.Plugins.BreezManager) {
        return await window.Capacitor.Plugins.BreezManager.payInvoice({ bolt11: invoice });
    }
    return "mock_preimage_for_unsupported_platform";
}
