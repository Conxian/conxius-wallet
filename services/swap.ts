import { AppState } from "../types";
import { Network } from '../types';
import { fetchWithRetry, sanitizeError } from './network';
import { generateRandomString } from './random';
import { calculateEffectiveFeeRate } from './monetization';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import { knownUnsupportedValueOperation, type AuthorizedValueOperationExecution, type ValueOperationExecutionOutcome } from './value-operation-result';

export const SWAP_EXPERIMENTAL = true;

export interface SwapQuote {
  id: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  toAmount: number;
  fee: number;
  effectiveFeeRate: number;
  provider: 'Changelly' | 'THORChain' | 'Boltz' | 'LI.FI' | '1inch';
  estimatedTime: number;
  transactionRequest?: any;
}

export const isChangellyReady = (): boolean => !!(import.meta as any).env?.VITE_CHANGELLY_PROXY_URL;

/**
 * Changelly Quote: Integrated B2B Swap Provider.
 */
export const fetchChangellyQuote = async (from: string, to: string, amount: number, state: AppState, network: Network = 'mainnet'): Promise<SwapQuote> => {
    void network;
    try {
        const proxyUrl = (import.meta as any).env?.VITE_CHANGELLY_PROXY_URL;
        if (!proxyUrl) throw new Error('Changelly proxy missing');
        const response = await fetchWithRetry(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'quote_' + Date.now(),
                method: 'getExchangeAmount',
                params: [{ from, to, amount: amount.toString() }]
            })
        });
        if (!response.ok) throw new Error('Changelly quote failed');
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const result = data.result[0];
        const rate = calculateEffectiveFeeRate(state);
        return {
            id: 'chg_' + generateRandomString(10),
            fromAsset: from, toAsset: to, fromAmount: amount,
            toAmount: parseFloat(result.amount),
            fee: parseFloat(result.networkFee || '0') + (amount * rate),
            effectiveFeeRate: rate,
            provider: 'Changelly', estimatedTime: 15
        };
    } catch (e) {
        throw new Error(sanitizeError(e, 'Changelly quote unavailable'), { cause: e });
    }
};

/**
 * LI.FI Quote: Cross-Chain Aggregator for EVM and Bitcoin L2s.
 */
export const fetchLifiQuote = async (
    fromChain: number,
    toChain: number,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    fromAddress: string,
    state: AppState
): Promise<SwapQuote> => {
    try {
        const url = `https://li.quest/v1/quote?fromChain=${fromChain}&toChain=${toChain}&fromToken=${fromToken}&toToken=${toToken}&fromAmount=${fromAmount}&fromAddress=${fromAddress}&referrer=conxius`;
        const response = await fetchWithRetry(url, { headers: { 'accept': 'application/json' } });
        const data = await response.json();
        const rate = calculateEffectiveFeeRate(state);
        const fee = (parseFloat(data.estimate.gasCosts?.[0]?.amount || '0') / 1e18) + (parseFloat(fromAmount) / 1e18 * rate);
        return {
            id: 'lifi_' + data.transactionId,
            fromAsset: fromToken,
            toAsset: toToken,
            fromAmount: parseFloat(fromAmount) / 1e18,
            toAmount: parseFloat(data.estimate.toAmount) / 1e18,
            fee,
            effectiveFeeRate: rate,
            provider: 'LI.FI',
            estimatedTime: Math.floor(data.estimate.executionDuration / 60) || 5,
            transactionRequest: data.transactionRequest
        };
    } catch (e) {
        throw new Error(sanitizeError(e, 'LI.FI bridge unavailable'), { cause: e });
    }
};

/**
 * 1inch Quote: DEX Aggregator for Layer 2s (BOB, Rootstock).
 */
export const fetch1inchQuote = async (
    chainId: number,
    fromToken: string,
    toToken: string,
    amount: string,
    fromAddress: string,
    state: AppState
): Promise<SwapQuote> => {
    try {
        const gateway = (import.meta as any).env?.VITE_GATEWAY_URL || 'https://gateway.conxianlabs.com';
        const url = `${gateway}/1inch/v6.0/${chainId}/swap?src=${fromToken}&dst=${toToken}&amount=${amount}&from=${fromAddress}&slippage=1&disableEstimate=true&includeTokensInfo=true&includeProtocols=true&includeGas=true`;
        const response = await fetchWithRetry(url, { headers: { 'accept': 'application/json' } });
        const data = await response.json();
        const rate = calculateEffectiveFeeRate(state);
        const fee = (parseFloat(data.gasPrice) * parseFloat(data.tx.gas) / 1e18) + (parseFloat(amount) / 1e18 * rate);
        return {
            id: '1inch_' + generateRandomString(10),
            fromAsset: fromToken,
            toAsset: toToken,
            fromAmount: parseFloat(amount) / 1e18,
            toAmount: parseFloat(data.toAmount) / 1e18,
            fee,
            effectiveFeeRate: rate,
            provider: '1inch',
            estimatedTime: 2,
            transactionRequest: data.tx
        };
    } catch (e) {
        throw new Error(sanitizeError(e, '1inch aggregator unavailable'), { cause: e });
    }
};

export interface BoltzSwapArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.boltz-swap.v1'; readonly operation: 'execute-boltz-swap'; readonly chain: 'bitcoin'; readonly layer: 'swap'; readonly network: Network;
    readonly quoteDigest: string; readonly providerIdentity: 'Boltz'; readonly providerConfigurationDigest: string; readonly sourceAsset: string; readonly targetAsset: string;
    readonly sourceNetwork: string; readonly targetNetwork: string; readonly amountBaseUnits: string; readonly invoiceDigest: string; readonly refundAddress: string;
    readonly destinationAddress: string; readonly expiry: string; readonly route: string; readonly htlcArtifactDigest: string; readonly maxFeeBaseUnits: string;
    readonly maxSlippageBps: string; readonly idempotencyDigest: string;
}
export interface GasSwapArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.gas-swap.v1'; readonly operation: 'execute-gas-swap'; readonly chain: 'cross-chain'; readonly layer: 'swap'; readonly network: Network;
    readonly quoteDigest: string; readonly providerIdentity: string; readonly providerConfigurationDigest: string; readonly sourceAsset: string; readonly targetAsset: string;
    readonly sourceNetwork: string; readonly targetNetwork: string; readonly amountBaseUnits: string; readonly depositAddress: string; readonly destinationAddress: string;
    readonly expiry: string; readonly route: string; readonly unsignedTransactionDigest: string; readonly maxFeeBaseUnits: string; readonly maxSlippageBps: string; readonly idempotencyDigest: string;
}
export interface ChangellyPaymentInstructionArtifact extends CanonicalObject {
    readonly kind: 'conxius.wallet.changelly-payment-instruction.v1'; readonly operation: 'request-changelly-payment-instruction'; readonly chain: 'cross-chain'; readonly layer: 'swap'; readonly network: Network;
    readonly quoteDigest: string; readonly providerIdentity: 'Changelly'; readonly providerConfigurationDigest: string; readonly sourceAsset: string; readonly targetAsset: string;
    readonly sourceNetwork: string; readonly targetNetwork: string; readonly amountBaseUnits: string; readonly destinationAddress: string; readonly refundAddress: string;
    readonly expiry: string; readonly route: string; readonly maxFeeBaseUnits: string; readonly maxSlippageBps: string; readonly idempotencyDigest: string;
}
export type BoltzSwapRequest = AuthorizedValueOperationExecution<BoltzSwapArtifact>;
export type GasSwapRequest = AuthorizedValueOperationExecution<GasSwapArtifact>;
export type ChangellyPaymentInstructionRequest = AuthorizedValueOperationExecution<ChangellyPaymentInstructionArtifact>;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
const required = (value: string, field: string): string => { const normalized = value.trim(); if (!normalized) throw new Error(`Invalid swap ${field}.`); return normalized; };
const canonicalUnsigned = (value: string, field: string): string => { if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`Invalid swap ${field}.`); return value; };
const digest = (value: string, field: string): string => { const normalized = value.toLowerCase(); if (!HEX_DIGEST.test(normalized)) throw new Error(`Invalid swap ${field} digest.`); return normalized; };
const digestText = (kind: string, value: string): string => digestCanonicalPayload(Object.freeze({ kind, value }));

export function createBoltzSwapArtifact(fields: {
    network: Network; quoteDigest: string; providerConfigurationDigest: string; sourceAsset: string; targetAsset: string; sourceNetwork: string; targetNetwork: string;
    amountBaseUnits: string; invoice: string; refundAddress: string; destinationAddress: string; expiry: string; route: string; htlcArtifactDigest: string;
    maxFeeBaseUnits: string; maxSlippageBps: string; idempotencyDigest: string;
}): BoltzSwapArtifact {
    return Object.freeze({
        kind: 'conxius.wallet.boltz-swap.v1', operation: 'execute-boltz-swap', chain: 'bitcoin', layer: 'swap', network: fields.network,
        quoteDigest: digest(fields.quoteDigest, 'quote'), providerIdentity: 'Boltz', providerConfigurationDigest: digest(fields.providerConfigurationDigest, 'provider configuration'),
        sourceAsset: required(fields.sourceAsset, 'source asset'), targetAsset: required(fields.targetAsset, 'target asset'), sourceNetwork: required(fields.sourceNetwork, 'source network'),
        targetNetwork: required(fields.targetNetwork, 'target network'), amountBaseUnits: canonicalUnsigned(fields.amountBaseUnits, 'amount'),
        invoiceDigest: digestText('conxius.wallet.swap-invoice.v1', required(fields.invoice, 'invoice')), refundAddress: required(fields.refundAddress, 'refund address'),
        destinationAddress: required(fields.destinationAddress, 'destination address'), expiry: canonicalUnsigned(fields.expiry, 'expiry'), route: required(fields.route, 'route'),
        htlcArtifactDigest: digest(fields.htlcArtifactDigest, 'HTLC artifact'), maxFeeBaseUnits: canonicalUnsigned(fields.maxFeeBaseUnits, 'maximum fee'),
        maxSlippageBps: canonicalUnsigned(fields.maxSlippageBps, 'maximum slippage'), idempotencyDigest: digest(fields.idempotencyDigest, 'idempotency'),
    });
}

export function createGasSwapArtifact(fields: {
    network: Network; quoteDigest: string; providerIdentity: string; providerConfigurationDigest: string; sourceAsset: string; targetAsset: string; sourceNetwork: string;
    targetNetwork: string; amountBaseUnits: string; depositAddress: string; destinationAddress: string; expiry: string; route: string; unsignedTransactionDigest: string;
    maxFeeBaseUnits: string; maxSlippageBps: string; idempotencyDigest: string;
}): GasSwapArtifact {
    return Object.freeze({
        kind: 'conxius.wallet.gas-swap.v1', operation: 'execute-gas-swap', chain: 'cross-chain', layer: 'swap', network: fields.network,
        quoteDigest: digest(fields.quoteDigest, 'quote'), providerIdentity: required(fields.providerIdentity, 'provider identity'),
        providerConfigurationDigest: digest(fields.providerConfigurationDigest, 'provider configuration'), sourceAsset: required(fields.sourceAsset, 'source asset'),
        targetAsset: required(fields.targetAsset, 'target asset'), sourceNetwork: required(fields.sourceNetwork, 'source network'), targetNetwork: required(fields.targetNetwork, 'target network'),
        amountBaseUnits: canonicalUnsigned(fields.amountBaseUnits, 'amount'), depositAddress: required(fields.depositAddress, 'deposit address'),
        destinationAddress: required(fields.destinationAddress, 'destination address'), expiry: canonicalUnsigned(fields.expiry, 'expiry'), route: required(fields.route, 'route'),
        unsignedTransactionDigest: digest(fields.unsignedTransactionDigest, 'unsigned transaction'), maxFeeBaseUnits: canonicalUnsigned(fields.maxFeeBaseUnits, 'maximum fee'),
        maxSlippageBps: canonicalUnsigned(fields.maxSlippageBps, 'maximum slippage'), idempotencyDigest: digest(fields.idempotencyDigest, 'idempotency'),
    });
}

export function createChangellyPaymentInstructionArtifact(fields: {
    quote: SwapQuote; network: Network; providerConfigurationDigest: string; sourceNetwork: string; targetNetwork: string; amountBaseUnits: string;
    destinationAddress: string; refundAddress: string; expiry: string; route: string; maxFeeBaseUnits: string; maxSlippageBps: string; idempotencyDigest: string;
}): ChangellyPaymentInstructionArtifact {
    if (fields.quote.provider !== 'Changelly') throw new Error('Invalid Changelly quote provider.');
    const quoteDigest = digestCanonicalPayload(Object.freeze({
        kind: 'conxius.wallet.changelly-quote.v1', provider: fields.quote.provider, quoteId: required(fields.quote.id, 'quote ID'),
        sourceAsset: required(fields.quote.fromAsset, 'source asset'), targetAsset: required(fields.quote.toAsset, 'target asset'),
        fromAmount: String(fields.quote.fromAmount), toAmount: String(fields.quote.toAmount), fee: String(fields.quote.fee), effectiveFeeRate: String(fields.quote.effectiveFeeRate),
    }));
    return Object.freeze({
        kind: 'conxius.wallet.changelly-payment-instruction.v1', operation: 'request-changelly-payment-instruction', chain: 'cross-chain', layer: 'swap', network: fields.network,
        quoteDigest, providerIdentity: 'Changelly', providerConfigurationDigest: digest(fields.providerConfigurationDigest, 'provider configuration'),
        sourceAsset: required(fields.quote.fromAsset, 'source asset'), targetAsset: required(fields.quote.toAsset, 'target asset'), sourceNetwork: required(fields.sourceNetwork, 'source network'),
        targetNetwork: required(fields.targetNetwork, 'target network'), amountBaseUnits: canonicalUnsigned(fields.amountBaseUnits, 'amount'),
        destinationAddress: required(fields.destinationAddress, 'destination address'), refundAddress: required(fields.refundAddress, 'refund address'),
        expiry: canonicalUnsigned(fields.expiry, 'expiry'), route: required(fields.route, 'route'), maxFeeBaseUnits: canonicalUnsigned(fields.maxFeeBaseUnits, 'maximum fee'),
        maxSlippageBps: canonicalUnsigned(fields.maxSlippageBps, 'maximum slippage'), idempotencyDigest: digest(fields.idempotencyDigest, 'idempotency'),
    });
}

export const executeBoltzSwap = async (request: BoltzSwapRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, { artifactKind: 'conxius.wallet.boltz-swap.v1', operationType: 'execute-boltz-swap', layer: 'swap', chain: 'bitcoin' });

export const buildThorchainMemo = (action: 'SWAP' | 'ADD', asset: string, destAddr: string, limit?: number): string => `${action}:${asset}:${destAddr}${limit ? ':' + limit : ''}`;

/** Provider payment instructions are not source submission or settlement. Provider issuance is unsupported. */
export const createChangellyPaymentInstruction = async (request: ChangellyPaymentInstructionRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, { artifactKind: 'conxius.wallet.changelly-payment-instruction.v1', operationType: 'request-changelly-payment-instruction', layer: 'swap', chain: 'cross-chain' });

export const executeGasSwap = async (request: GasSwapRequest): Promise<ValueOperationExecutionOutcome> =>
    knownUnsupportedValueOperation(request, { artifactKind: 'conxius.wallet.gas-swap.v1', operationType: 'execute-gas-swap', layer: 'swap', chain: 'cross-chain' });
