import { fetchWithRetry, endpointsFor, fetchBtcPrice } from './protocol';
import { Network } from '../types';
import { calculateNttFee } from './monetization';

export interface FeeEstimation {
  sourceNetworkFee: number;
  destinationNetworkFee: number;
  wormholeBridgeFee: number;
  gasAbstractionSwapFee: number;
  integratorFee: number;
  totalFee: number;
  efficiencyRating: 'optimal' | 'high' | 'low';
}

export const estimateFees = async (sourceLayer: string, targetLayer: string, amount: string, enableGasAbstractionSwap: boolean = false, network: Network = 'mainnet'): Promise<FeeEstimation> => {
  const getFee = async (layer: string) => 0.00005; // Simplified for now
  const [sourceFee, destinationFee, btcPrice] = await Promise.all([getFee(sourceLayer), getFee(targetLayer), fetchBtcPrice()]);
  const integratorFee = calculateNttFee(parseFloat(amount) || 0, btcPrice);
  const total = sourceFee + destinationFee + 0.0001 + (enableGasAbstractionSwap ? 0.00002 : 0) + integratorFee;
  return { sourceNetworkFee: sourceFee, destinationNetworkFee: destinationFee, wormholeBridgeFee: 0.0001, gasAbstractionSwapFee: 0.00002, integratorFee, totalFee: total, efficiencyRating: 'optimal' };
};
