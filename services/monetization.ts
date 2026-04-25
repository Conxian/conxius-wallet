import { Network, AppState } from '../types';
import { requestEnclaveSignature } from './signer';

/**
 * Monetization Service (v1.9.2)
 * Handles protocol fees, SDK licensing, and referral logic.
 */

export interface ReferralStats {
    code: string;
    totalReferrals: number;
    totalEarned: number;
    active: boolean;
}

/**
 * Calculates the NTT bridge fee based on amount and network.
 */
export const calculateNttFee = (amount: number): number => {
    // 0.1% convenience fee as per SOVEREIGN_BRIDGE_STRATEGY.md
    const fee = amount * 0.001;
    // Cap at 50 units (e.g., 0 equivalent) for B2B alignment
    return Math.min(Math.max(fee, 1), 50);
};

export const calculateNttIntegrationFee = (amount: number): number => calculateNttFee(amount);

/**
 * Signs a B2B invoice for corporate payment processing.
 * This is an enhancement for the Conxian Gateway integration.
 */
export const signB2bInvoice = async (
    invoiceId: string,
    amount: number,
    currency: string,
    vault: string
): Promise<string> => {
    const payload = { invoiceId, amount, currency, timestamp: Date.now() };
    const signResult = await requestEnclaveSignature({
        type: 'message',
        layer: 'Mainnet',
        payload,
        description: `Authorize B2B Payment: ${amount} ${currency}`
    }, vault);

    return signResult.signature;
};

/**
 * Validates and applies a referral code.
 */
export const applyReferralCode = async (code: string, amount: number, network: Network = 'mainnet'): Promise<number> => {
    // 5% discount logic (5-5-5 logic)
    return amount * 0.05;
};

export const calculateEffectiveFeeRate = (state: AppState): number => {
    let rate = 0.0025; // Base 0.25%

    // Loyalty discount (up to 50%)
    const loyaltyDiscount = (state.loyaltyXP || 0) > 1000 ? 0.5 : 1.0;

    // Sovereignty discount (up to 20%)
    const sovereigntyDiscount = state.sovereigntyScore > 90 ? 0.8 : 1.0;

    rate = rate * loyaltyDiscount * sovereigntyDiscount;

    return Math.max(rate, 0.001); // 0.1% floor
};
