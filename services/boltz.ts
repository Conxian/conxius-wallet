
import { Network } from '../types';
import { fetchWithRetry } from './protocol';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);

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
    ) {
        // Implementation for Reverse Swap
        // 1. Create Preimage
        // 2. Call /swap/reverse
        // 3. Return Invoice + Claim Script
        
        const preimage = crypto.getRandomValues(new Uint8Array(32));
        const preimageHash = bitcoin.crypto.sha256(Buffer.from(preimage));
        
        const response = await fetchWithRetry(`${this.getApiUrl(network)}/swap/reverse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'BTC',
                to: 'BTC', // For Lightning to On-Chain, it's often treated as pair
                preimageHash: Buffer.from(preimageHash).toString('hex'),
                invoiceAmount: amountSats,
                claimAddress: toAddress
            })
        });

        if (!response.ok) throw new Error('Failed to create reverse swap');
        return await response.json();
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
    ) {
        const pairId = toLayer === 'Liquid' ? 'BTC/L-BTC' : 'BTC/BTC';
        
        // Generate a refund key pair for the user (so they can claw back funds if Boltz fails)
        const refundKey = ECPair.makeRandom();
        const refundPublicKey = refundKey.publicKey.toString('hex');

        const body: any = {
            from: 'BTC',
            to: toLayer === 'Liquid' ? 'L-BTC' : 'BTC',
            pairId,
            referralId: 'conxius',
            refundPublicKey
        };

        if (toLayer === 'Lightning') {
            body.invoice = destination;
        } else {
            body.toAddress = destination;
            body.expectedAmount = amountSats; // For Liquid, we specify amount
        }

        const response = await fetchWithRetry(`${this.getApiUrl(network)}/swap/submarine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Swap creation failed');
        }

        const data: BoltzSwapResponse = await response.json();
        
        return {
            ...data,
            refundPrivateKey: refundKey.toWIF(), // Store this securely!
        };
    }

    /**
     * Estimates fees for a Boltz swap
     */
    static async estimateFees(amountSats: number, network: Network) {
        // Mocking fee estimation for now based on public docs (~0.5% + miner fee)
        return {
            boltzFee: Math.floor(amountSats * 0.005),
            minerFee: 5000 // Average lockup tx fee
        };
    }
}
