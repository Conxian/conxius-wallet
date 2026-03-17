import { AppState } from "../types";
import { notificationService } from './notifications';
import { Network } from '../types';
import { endpointsFor, fetchWithRetry, sanitizeError } from './network';
import { requestEnclaveSignature } from './signer';
import { generateRandomString } from './random';
import { calculateEffectiveFeeRate } from './monetization';

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
        throw new Error(sanitizeError(e, 'Changelly quote unavailable'));
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
        throw new Error(sanitizeError(e, 'LI.FI bridge unavailable'));
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
        throw new Error(sanitizeError(e, '1inch aggregator unavailable'));
    }
};

export const executeBoltzSwap = async (invoice: string, refundAddress: string, network: Network): Promise<string> => {
    notificationService.notifyTransaction('Boltz Swap', 'Initiating Submarine Swap...', true);
    return 'boltz_tx_' + Date.now();
};

export const buildThorchainMemo = (action: 'SWAP' | 'ADD', asset: string, destAddr: string, limit?: number): string => `${action}:${asset}:${destAddr}${limit ? ':' + limit : ''}`;

/**
 * Finalizes a Changelly Transaction with Sovereign Guarding.
 */
export const createChangellyTransaction = async (quote: SwapQuote, destAddress: string, network: Network) => {
    try {
        const proxyUrl = (import.meta as any).env?.VITE_CHANGELLY_PROXY_URL;
        if (!proxyUrl) throw new Error('Changelly proxy missing');
        const response = await fetchWithRetry(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'tx_' + Date.now(),
                method: 'createTransaction',
                params: {
                    from: quote.fromAsset,
                    to: quote.toAsset,
                    address: destAddress,
                    amountFrom: quote.fromAmount.toString(),
                    extraFee: (quote.effectiveFeeRate * 100).toFixed(2),
                    affiliate: "conxius"
                }
            })
        });
        if (!response.ok) throw new Error('Failed to create transaction');
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        notificationService.notify({ category: 'SYSTEM', type: 'success', title: 'Swap Initialized', message: `Swap for ${quote.toAmount} ${quote.toAsset} initialized.` });
        return { payinAddress: data.result.payinAddress, id: data.result.id };
    } catch (e) {
        throw new Error(sanitizeError(e, 'Swap initialization failed'));
    }
};

export const executeGasSwap = async (amount: number, network: Network): Promise<string> => {
    notificationService.notifyTransaction('Gas Abstraction', 'Swapping for native gas...', true);
    return 'gas_swap_tx_' + Date.now();
};
