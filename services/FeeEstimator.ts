// services/FeeEstimator.ts

import { AppState } from '../types';

export interface FeeEstimation {
  sourceNetworkFee: number;
  destinationNetworkFee: number;
  wormholeBridgeFee: number;
  gasAbstractionSwapFee: number;
  totalFee: number;
  efficiencyRating: 'optimal' | 'high' | 'low';
}

const MOCK_FEES: Record<string, any> = {
  'mainnet': { base: 0.00004, fluctuation: 0.00002 },
  'stacks': { base: 0.000025, fluctuation: 0.00001 },
  'rootstock': { base: 0.00008, fluctuation: 0.00005 },
  'ethereum': { base: 0.00025, fluctuation: 0.00015 },
  'liquid': { base: 0.000035, fluctuation: 0.00001 },
  'wormhole': 0.00012,
  'swap': 0.00002,
};

/**
 * Fetches real-time Bitcoin fee rates from mempool.space
 */
async function getBitcoinFeeRate(): Promise<number> {
  try {
    const response = await fetch('https://mempool.space/api/v1/fees/recommended');
    if (!response.ok) throw new Error('Mempool API error');
    const data = await response.json();
    // Assuming a standard 140 vbyte transaction for estimation
    const satPerVbyte = data.hourFee;
    return (satPerVbyte * 140) / 100_000_000; // Convert to BTC
  } catch (error) {
    console.warn('Failed to fetch real-time BTC fees, using fallback', error);
    return MOCK_FEES.mainnet.base;
  }
}

/**
 * Estimates the fees for a cross-chain transfer.
 */
export const estimateFees = async (
  sourceLayer: string,
  targetLayer: string,
  enableGasAbstractionSwap: boolean = false
): Promise<FeeEstimation> => {

  // Real-time fetch for BTC if it's the source or target
  let sourceFeePromise: Promise<number> | number;
  let destinationFeePromise: Promise<number> | number;

  const getFallbackFee = (layer: string) => {
    const feeConfig = MOCK_FEES[layer.toLowerCase()];
    if (typeof feeConfig === 'object' && feeConfig !== null) {
      return feeConfig.base + Math.random() * feeConfig.fluctuation;
    }
    return feeConfig || 0;
  };

  if (sourceLayer.toLowerCase() === 'mainnet') {
    sourceFeePromise = getBitcoinFeeRate();
  } else {
    sourceFeePromise = getFallbackFee(sourceLayer);
  }

  if (targetLayer.toLowerCase() === 'mainnet') {
    destinationFeePromise = getBitcoinFeeRate();
  } else {
    destinationFeePromise = getFallbackFee(targetLayer);
  }

  const [sourceFee, destinationFee] = await Promise.all([
    Promise.resolve(sourceFeePromise),
    Promise.resolve(destinationFeePromise)
  ]);

  const wormholeFee = MOCK_FEES['wormhole'];
  const swapFee = enableGasAbstractionSwap ? MOCK_FEES['swap'] : 0;

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
