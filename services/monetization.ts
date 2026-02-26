import { AppState } from '../types';
import { calculateSovereigntyScore } from './sovereignty';

export const BASE_FEE = 0.0025;
export const FLOOR_FEE = 0.001;
export const NTT_FEE_RATE = 0.001;
export const NTT_FEE_CAP_USD = 50;

export const calculateEffectiveFeeRate = (state: AppState): number => {
    const score = calculateSovereigntyScore(state);
    const loyaltyDiscount = state.version === '1.5.0' ? 0.5 : 0;
    const sovereigntyMultiplier = score * 0.2;
    let effectiveFee = BASE_FEE * (1 - loyaltyDiscount) * (1 - sovereigntyMultiplier);
    return Math.max(effectiveFee, FLOOR_FEE);
};

export const calculateSovereignSpread = (amount: number, state: AppState): number => {
    const rate = calculateEffectiveFeeRate(state);
    return amount * rate;
};

export const calculateNttFee = (amountBtc: number, btcPriceUsd: number): number => {
    const feeBtc = amountBtc * NTT_FEE_RATE;
    const feeUsd = feeBtc * btcPriceUsd;
    if (feeUsd > NTT_FEE_CAP_USD) return NTT_FEE_CAP_USD / btcPriceUsd;
    return feeBtc;
};
