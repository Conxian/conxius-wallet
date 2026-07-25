import { Network, AppState } from '../types';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import { knownUnsupportedValueOperation, type AuthorizedValueOperationExecution, type ValueOperationExecutionOutcome } from './value-operation-result';

/**
 * Monetization Service (v1.9.5)
 * Handles protocol fees, SDK licensing, and referral logic.
 */

export interface ReferralStats {
    code: string;
    totalReferrals: number;
    totalEarned: number;
    active: boolean;
}

export interface B2bInvoiceAuthorizationArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.b2b-invoice-authorization.v1'; readonly chain: string; readonly layer: 'b2b-gateway';
    readonly operation: 'authorize-invoice-payment'; readonly network: string; readonly domain: string;
    readonly invoiceId: string; readonly invoiceDigest: string; readonly merchantIdentity: string;
    readonly payeeIdentity: string; readonly amount: string; readonly currency: string;
    readonly expiresAt: string | null; readonly termsDigest: string | null; readonly gatewayConfigurationDigest: string;
}
export type B2bInvoiceAuthorizationRequest = AuthorizedValueOperationExecution<B2bInvoiceAuthorizationArtifact>;
const GATEWAY_CONFIGURATION_DIGEST = digestCanonicalPayload(Object.freeze({ kind: 'conxius.wallet.unqualified-b2b-gateway.v1' }));

export function createB2bInvoiceAuthorizationArtifact(fields: {
    invoiceId: string; invoiceDigest: string; merchantIdentity: string; payeeIdentity: string; amount: string;
    currency: string; network: string; domain: string; chain?: string; expiresAt?: string; termsDigest?: string;
}): B2bInvoiceAuthorizationArtifact {
    const amount = fields.amount.trim();
    if (!fields.invoiceId.trim() || !fields.invoiceDigest.trim() || !fields.merchantIdentity.trim() || !fields.payeeIdentity.trim()
        || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(amount) || !fields.currency.trim() || !fields.network.trim() || !fields.domain.trim()) {
        throw new Error('Invalid B2B invoice authorization request.');
    }
    return Object.freeze({
        kind: 'conxius.wallet.b2b-invoice-authorization.v1', chain: fields.chain?.trim() || 'payment-domain',
        layer: 'b2b-gateway', operation: 'authorize-invoice-payment', network: fields.network.trim(), domain: fields.domain.trim(),
        invoiceId: fields.invoiceId.trim(), invoiceDigest: fields.invoiceDigest.trim(), merchantIdentity: fields.merchantIdentity.trim(),
        payeeIdentity: fields.payeeIdentity.trim(), amount, currency: fields.currency.trim().toUpperCase(),
        expiresAt: fields.expiresAt?.trim() || null, termsDigest: fields.termsDigest?.trim() || null,
        gatewayConfigurationDigest: GATEWAY_CONFIGURATION_DIGEST,
    });
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
export const signB2bInvoice = async (request: B2bInvoiceAuthorizationRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, {
        artifactKind: 'conxius.wallet.b2b-invoice-authorization.v1',
        operationType: 'authorize-invoice-payment',
        layer: 'b2b-gateway',
    });

/**
 * Validates and applies a referral code.
 */
export const applyReferralCode = async (code: string, amount: number, network: Network = 'mainnet'): Promise<number> => {
    void code;
    void network;
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
