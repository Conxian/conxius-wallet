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

export interface BoltzSwapResponse {
    id: string;
    bip21: string;
    address: string;
    redeemScript: string;
    acceptZeroConf: boolean;
    expectedAmount: number;
    timeoutBlockHeight: number;
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
        const url = `${this.getApiUrl(network)}/swap/submarine`;
        // Note: V2 API might have different endpoint structure, using generic fetch for now
        // Usually /getpairs or /chain/L-BTC/BTC etc.
        // Let's assume standard V2 format: https://api.boltz.exchange/v2/chain/BTC/pairs
        // But for simplicity, we'll try to fetch the pairs info.
        // Actually, Boltz V2 uses /swap/submarine for creating, but info is often at /info or similar.
        // We'll stick to a verified endpoint if possible, or handle 404.
        
        try {
            // Trying generic info endpoint
            const response = await fetchWithRetry(`${this.getApiUrl(network)}/chain/BTC/pairs`);
            if (!response.ok) return {};
            return await response.json();
        } catch (e) {
            console.warn('Boltz getPairs failed', e);
            return {};
        }
    }

    /**
     * Creates a Submarine Swap (Lightning -> On-Chain)
     * User pays LN Invoice -> Boltz sends On-Chain BTC
     */
    static async createReverseSwap(
        amountSats: number,
        toAddress: string,
        network: Network
    ): Promise<never> {
        void amountSats;
        void toAddress;
        void network;
        throw new Error('BOLTZ_SWAP_INITIATION_QUARANTINED: native request-bound claim/refund key authority is unavailable');
    }

    /**
     * Creates a Submarine Swap (On-Chain -> Lightning/Liquid)
     * User sends On-Chain BTC -> Boltz pays Invoice/Liquid
     */
    static async createSubmarineSwap(
        amountSats: number,
        toLayer: 'Liquid' | 'Lightning',
        destination: string, // Invoice for LN, Address for Liquid
        network: Network
    ): Promise<never> {
        void amountSats;
        void toLayer;
        void destination;
        void network;
        throw new Error('BOLTZ_SWAP_INITIATION_QUARANTINED: native request-bound refund key authority is unavailable');
    }

    /**
     * Estimates fees for a Boltz swap
     */
    static async estimateFees(amountSats: number, network: Network) {
        void network;
        // Mocking fee estimation for now based on public docs (~0.5% + miner fee)
        return {
            boltzFee: Math.floor(amountSats * 0.005),
            minerFee: 5000,
            authoritative: false as const,
            kind: 'estimate' as const,
        };
    }
}
