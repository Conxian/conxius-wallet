import { Network } from '../types';

export type FeeRecommendation = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
};

export async function getRecommendedFees(baseUrl: string): Promise<FeeRecommendation> {
  try {
    const url = `${baseUrl}/v1/fees/recommended`;
    const res = await fetch(url);
    if (!res.ok) {
      return { fastestFee: 15, halfHourFee: 8, hourFee: 5 };
    }
    return await res.json();
  } catch {
    return { fastestFee: 15, halfHourFee: 8, hourFee: 5 };
  }
}

/**
 * Fetches Stacks (L2) fee recommendations.
 */
export async function getStacksFees(stxApiUrl: string): Promise<number> {
  try {
    const response = await fetch(`${stxApiUrl}/v2/fees/transaction`, {
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
    const response = await fetch(`${liquidApiUrl}/fee-estimates`);
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
    const response = await fetch(rskApiUrl, {
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
