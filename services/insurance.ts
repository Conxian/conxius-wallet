import { AppState, Network } from '../types';
import { fetchWithRetry } from './network';
import { calculateEffectiveFeeRate } from './monetization';

export interface InsuranceCover { id: string; protocol: string; target: string; type: 'Smart Contract' | 'Stablecoin' | 'Bridge' | 'Custodian'; annualPremium: number; capacity: number; currency: string; }
export interface CoverPurchase { transactionData: any; referralFee: number; }

export async function fetchInsuranceCovers(): Promise<InsuranceCover[]> {
    return [
        { id: 'cv1', protocol: 'Neptune Mutual', target: 'Curve Finance', type: 'Smart Contract', annualPremium: 2.5, capacity: 5000000, currency: 'USDC' }
    ];
}

export async function purchaseInsuranceCover(coverId: string, amount: string, state: AppState, network: Network = 'mainnet'): Promise<CoverPurchase> {
    const referralFee = parseFloat(amount) * 0.05;
    return {
        transactionData: { to: '0xNeptuneMutualCoverPool', data: '0xPurchaseCoverCalldata', value: amount, chainId: network === 'mainnet' ? 1 : 11155111 },
        referralFee
    };
}
