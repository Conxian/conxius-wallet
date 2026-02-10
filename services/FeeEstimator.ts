// services/FeeEstimator.ts

import { fetchWithRetry, endpointsFor } from './protocol';
import { Network } from '../types';

export interface FeeEstimation {
  sourceNetworkFee: number;
  destinationNetworkFee: number;
  wormholeBridgeFee: number;
  gasAbstractionSwapFee: number;
  totalFee: number;
  efficiencyRating: 'optimal' | 'high' | 'low';
}

const FALLBACK_FEES: Record<string, number> = {
  'mainnet': 0.00004,
  'stacks': 0.000025,
  'rootstock': 0.00008,
  'ethereum': 0.00025,
  'liquid': 0.000035,
  'wormhole': 0.00012,
  'swap': 0.00002,
};

/**
 * Fetches real-time Bitcoin fee rates from mempool.space
 */
async function getBitcoinFeeRate(network: Network): Promise<number> {
  try {
    const { BTC_API } = endpointsFor(network);
    const response = await fetchWithRetry(`${BTC_API}/v1/fees/recommended`);
    if (!response.ok) throw new Error('Mempool API error');
    const data = await response.json();
    const satPerVbyte = data.hourFee;
    return (satPerVbyte * 140) / 100_000_000;
  } catch (error) {
    console.warn('[FeeEstimator] BTC fee fetch failed, using fallback', error);
    return FALLBACK_FEES.mainnet;
  }
}

/**
 * Fetches real-time Stacks fee estimate from Hiro API
 */
async function getStacksFeeRate(network: Network): Promise<number> {
  try {
    const { STX_API } = endpointsFor(network);
    const response = await fetchWithRetry(`${STX_API}/v2/fees/transfer`);
    if (!response.ok) throw new Error('Hiro fee API error');
    const feeEstimate = await response.json();
    // Hiro returns fee in microSTX; convert to BTC equivalent
    // feeEstimate is the total fee in microSTX for a standard transfer
    const feeInStx = (typeof feeEstimate === 'number' ? feeEstimate : 1000) / 1_000_000;
    
    // Approximate STX→BTC conversion (fetch real price if needed)
    // We try to fetch real price, but fallback to static ratio if it fails
    let stxBtcRatio = 0.0000035;
    try {
        const stxPriceResp = await fetchWithRetry('https://api.coingecko.com/api/v3/simple/price?ids=stacks&vs_currencies=btc');
        if (stxPriceResp.ok) {
            const priceData = await stxPriceResp.json();
            if (priceData.stacks?.btc) stxBtcRatio = priceData.stacks.btc;
        }
    } catch {}

    return feeInStx * stxBtcRatio;
  } catch (error) {
    console.warn('[FeeEstimator] STX fee fetch failed, using fallback', error);
    return FALLBACK_FEES.stacks;
  }
}

/**
 * Fetches real-time RSK gas price via JSON-RPC
 */
async function getRskFeeRate(network: Network): Promise<number> {
  try {
    const { RSK_API } = endpointsFor(network);
    const response = await fetchWithRetry(RSK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 })
    });
    if (!response.ok) throw new Error('RSK RPC error');
    const data = await response.json();
    const gasPriceWei = parseInt(data.result, 16);
    // Standard transfer = 21000 gas; convert wei to RBTC (1e18)
    const feeRbtc = (gasPriceWei * 21000) / 1e18;
    // RBTC ≈ BTC (1:1 peg)
    return feeRbtc;
  } catch (error) {
    console.warn('[FeeEstimator] RSK fee fetch failed, using fallback', error);
    return FALLBACK_FEES.rootstock;
  }
}

/**
 * Fetches real-time Liquid network fee from Blockstream API
 */
async function getLiquidFeeRate(network: Network): Promise<number> {
  try {
    const { LIQUID_API } = endpointsFor(network);
    const response = await fetchWithRetry(`${LIQUID_API}/fee-estimates`);
    if (!response.ok) throw new Error('Liquid fee API error');
    const data = await response.json();
    // data is { "1": satPerVbyte, "2": ..., ... }; use the 2-block target
    const satPerVbyte = data['2'] || data['1'] || 0.1;
    // Liquid tx ~140 vbytes typical
    return (satPerVbyte * 140) / 100_000_000;
  } catch (error) {
    console.warn('[FeeEstimator] Liquid fee fetch failed, using fallback', error);
    return FALLBACK_FEES.liquid;
  }
}

/**
 * Estimates the fees for a cross-chain transfer.
 */
export const estimateFees = async (
  sourceLayer: string,
  targetLayer: string,
  enableGasAbstractionSwap: boolean = false,
  network: Network = 'mainnet'
): Promise<FeeEstimation> => {

  // Real-time fetch for BTC if it's the source or target
  let sourceFeePromise: Promise<number> | number;
  let destinationFeePromise: Promise<number> | number;

  const getFeeForLayer = (layer: string): Promise<number> | number => {
    switch (layer.toLowerCase()) {
      case 'mainnet': return getBitcoinFeeRate(network);
      case 'stacks': return getStacksFeeRate(network);
      case 'rootstock': return getRskFeeRate(network);
      case 'liquid': return getLiquidFeeRate(network);
      default: return FALLBACK_FEES[layer.toLowerCase()] || 0;
    }
  };

  sourceFeePromise = getFeeForLayer(sourceLayer);
  destinationFeePromise = getFeeForLayer(targetLayer);

  const [sourceFee, destinationFee] = await Promise.all([
    Promise.resolve(sourceFeePromise),
    Promise.resolve(destinationFeePromise)
  ]);

  const wormholeFee = FALLBACK_FEES['wormhole'];
  const swapFee = enableGasAbstractionSwap ? FALLBACK_FEES['swap'] : 0;

  const total = sourceFee + destinationFee + wormholeFee + swapFee;

  // Efficiency rating logic (simplified)
  let efficiencyRating: 'optimal' | 'high' | 'low' = 'high';
  if (total < 0.00015) efficiencyRating = 'optimal';
  if (total > 0.0004) efficiencyRating = 'low';

  return {
    sourceNetworkFee: sourceFee,
    destinationNetworkFee: destinationFee,
    wormholeBridgeFee: wormholeFee,
    gasAbstractionSwapFee: swapFee,
    totalFee: total,
    efficiencyRating
  };
};
