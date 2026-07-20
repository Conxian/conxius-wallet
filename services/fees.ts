import { fetchWithRetry, withAbortDeadline } from './network';
import {
  defaultBitcoinFeeOracleTransport,
  getCleanBlockFeeRecommendation,
  BITCOIN_FEE_ORACLE_LIMITS,
} from './bitcoin-fee-oracle';
import type { CleanBlockFeeOptions, FeeRecommendation } from './bitcoin-fee-oracle';

export type { FeeRecommendation } from './bitcoin-fee-oracle';
export type { BitcoinFeeOracleProvider, BitcoinFeeOracleTransport, CleanBlockFeeOptions } from './bitcoin-fee-oracle';

const FALLBACK_BTC_FEES = { fastestFee: 15, halfHourFee: 8, hourFee: 5 };

export type RecommendedFeesOptions = CleanBlockFeeOptions & {
  /** Disable the clean confirmed-block model and use the legacy endpoint only. */
  useCleanBlocks?: boolean;
  /** Bound the legacy endpoint attempt after clean sampling is unavailable. */
  legacyFallbackTimeoutMs?: number;
};

function legacyFallbackTimeoutMs(options: RecommendedFeesOptions): number {
  const value = options.legacyFallbackTimeoutMs;
  if (!Number.isSafeInteger(value)) return BITCOIN_FEE_ORACLE_LIMITS.legacyFallbackTimeoutMs;
  return Math.min(
    BITCOIN_FEE_ORACLE_LIMITS.maxLegacyFallbackTimeoutMs,
    Math.max(1, value as number),
  );
}

function parseFeeRecommendation(value: unknown): import('./bitcoin-fee-oracle').FeeRecommendation | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = value as Record<string, unknown>;
  const rates = [data.fastestFee, data.halfHourFee, data.hourFee];
  if (!rates.every(rate => typeof rate === 'number' && Number.isFinite(rate) && rate >= 0)) return null;
  return {
    fastestFee: Math.max(1, Math.ceil(rates[0] as number)),
    halfHourFee: Math.max(1, Math.ceil(rates[1] as number)),
    hourFee: Math.max(1, Math.ceil(rates[2] as number)),
  };
}

/**
 * Fetches BTC (L1) fee recommendations.
 */
export async function getRecommendedFees(baseUrl: string, options: RecommendedFeesOptions = {}): Promise<FeeRecommendation> {
  if (options.signal?.aborted) return FALLBACK_BTC_FEES;

  if (options.useCleanBlocks !== false) {
    const cleanRecommendation = await getCleanBlockFeeRecommendation(baseUrl, options);
    if (cleanRecommendation) return cleanRecommendation;
    if (options.signal?.aborted) return FALLBACK_BTC_FEES;
  }

  try {
    const transport = options.transport ?? defaultBitcoinFeeOracleTransport;
    const response = await withAbortDeadline(
      signal => transport.getJson<unknown>(
        `${baseUrl.replace(/\/+$/, '')}/v1/fees/recommended`,
        { signal },
      ),
      options.signal,
      legacyFallbackTimeoutMs(options),
    );
    return parseFeeRecommendation(response) ?? FALLBACK_BTC_FEES;
  } catch {
    return FALLBACK_BTC_FEES;
  }
}

/**
 * Fetches Stacks (L2) fee recommendations.
 */
export async function getStacksFees(stxApiUrl: string): Promise<number> {
  try {
    const response = await fetchWithRetry(`${stxApiUrl}/v2/fees/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_payload: '0x' }) // Generic payload for estimate
    });
    if (!response.ok) return 50; // Fallback mStx
    const data = await response.json();
    return data.estimations?.[0]?.fee || 50;
  } catch {
    return 50;
  }
}

/**
 * Fetches Liquid (Sidechain) fee recommendations.
 */
export async function getLiquidFees(liquidApiUrl: string): Promise<number> {
  try {
    const response = await fetchWithRetry(`${liquidApiUrl}/fee-estimates`);
    if (!response.ok) return 0.1; // sat/vB fallback
    const data = await response.json();
    // Liquid API returns fee estimates as map of { [blocks]: rate }
    return data['2'] || 0.1;
  } catch {
    return 0.1;
  }
}

/**
 * Fetches Rootstock (EVM) gas price.
 */
export async function getRskFees(rskApiUrl: string): Promise<number> {
  try {
    const response = await fetchWithRetry(rskApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1
      })
    });
    if (!response.ok) return 60000000; // 0.06 Gwei fallback
    const data = await response.json();
    return parseInt(data.result, 16);
  } catch {
    return 60000000;
  }
}
