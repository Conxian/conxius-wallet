import { AppState } from "../types";
import { notificationService } from './notifications';
import { Network } from '../types';
import { endpointsFor, fetchWithRetry } from './network';
import { requestEnclaveSignature } from './signer';
import { generateRandomString } from './random';
import { calculateEffectiveFeeRate } from './monetization';

export const SWAP_EXPERIMENTAL = false;

export interface SwapQuote {
  id: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  toAmount: number;
  fee: number;
  effectiveFeeRate: number;
  provider: 'Changelly' | 'THORChain' | 'Boltz';
  estimatedTime: number;
}

export const isChangellyReady = (): boolean => !!(import.meta as any).env?.VITE_CHANGELLY_PROXY_URL;

export const fetchChangellyQuote = async (from: string, to: string, amount: number, state: AppState, network: Network = 'mainnet'): Promise<SwapQuote> => {
    const proxyUrl = (import.meta as any).env?.VITE_CHANGELLY_PROXY_URL;
    if (!proxyUrl) throw new Error('Changelly proxy missing');
    const response = await fetchWithRetry(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'quote_' + Date.now(), method: 'getExchangeAmount', params: [{ from, to, amount: amount.toString() }] })
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
};

export const executeBoltzSwap = async (invoice: string, refundAddress: string, network: Network): Promise<string> => {
    notificationService.notifyTransaction('Boltz Swap', 'Initiating Submarine Swap...', true);
    return 'boltz_tx_' + Date.now();
};

export const buildThorchainMemo = (action: 'SWAP' | 'ADD', asset: string, destAddr: string, limit?: number): string => `${action}:${asset}:${destAddr}${limit ? ':' + limit : ''}`;

export const createChangellyTransaction = async (quote: SwapQuote, destAddress: string, network: Network) => {
    const proxyUrl = (import.meta as any).env?.VITE_CHANGELLY_PROXY_URL;
    if (!proxyUrl) throw new Error('Changelly proxy missing');
    const response = await fetchWithRetry(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'tx_' + Date.now(), method: 'createTransaction', params: { from: quote.fromAsset, to: quote.toAsset, address: destAddress, amountFrom: quote.fromAmount.toString(), extraFee: (quote.effectiveFeeRate * 100).toFixed(2), affiliate: "conxius" } })
    });
    if (!response.ok) throw new Error('Failed to create transaction');
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    notificationService.notify({ category: 'SYSTEM', type: 'success', title: 'Swap Initialized', message: `Swap for ${quote.toAmount} ${quote.toAsset} initialized.` });
    return { payinAddress: data.result.payinAddress, id: data.result.id };
};

export const executeGasSwap = async (amount: number, network: Network): Promise<string> => {
    notificationService.notifyTransaction('Gas Abstraction', 'Swapping for native gas...', true);
    return 'gas_swap_tx_' + Date.now();
};
