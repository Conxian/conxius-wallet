// @ts-nocheck

import { Network } from '../types';
import { fetchWithRetry } from './protocol';

export interface BoltzPair {
    limits: {
        maximal: number;
        minimal: number;
    };
    fees: {
        percentage: number;
        minerFees: {
            baseAsset: {
                normal: number;
                reverse: number;
            };
            quoteAsset: {
                normal: number;
                reverse: number;
            };
        };
    };
}

const BOLTZ_API_URL = {
    mainnet: 'https://api.boltz.exchange/v2',
    testnet: 'https://api.testnet.boltz.exchange/v2',
};

/**
 * Boltz Service - Trustless Submarine Swaps
 * Handles Atomic Swaps between Bitcoin, Lightning, and Liquid.
 */
export class BoltzService {

    static getApiUrl(network: Network): string {
        return network === 'mainnet' ? BOLTZ_API_URL.mainnet : BOLTZ_API_URL.testnet;
    }

    /**
     * Fetches supported pairs and their limits/fees.
     */
    static async getPairs(network: Network): Promise<Record<string, BoltzPair>> {
        try {
            const response = await fetchWithRetry(`${this.getApiUrl(network)}/chain/BTC/pairs`);
            if (!response.ok) return {};
            return await response.json();
        } catch (e) {
            console.warn('Boltz getPairs failed', e);
            return {};
        }
    }

    /**
     * Estimates fees for a Boltz swap
     */
    static async estimateFees(amountSats: number, network: Network) {
        void network;
        // Mocking fee estimation for now based on public docs (~0.5% + miner fee)
        return {
            boltzFee: Math.floor(amountSats * 0.005),
            minerFee: 5000 // Average lockup tx fee
        };
    }
}
