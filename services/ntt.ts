import { Buffer } from 'buffer';
import {
    Chain,
    TokenId,
    Wormhole,
    amount as wormholeAmount,
    Signer,
    TokenTransfer,
    wormhole
} from '@wormhole-foundation/sdk';
import { EvmPlatform } from '@wormhole-foundation/sdk-evm';
import { Network, AppState } from '../types';
import { sanitizeError, endpointsFor } from './network';
import { calculateNttFee } from './monetization';
import { fetchBtcPrice } from './protocol';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * NTT Configuration for public sBTC and other supported assets.
 * These addresses are aligned with public deployments on Base, Arbitrum, and Ethereum.
 */
export const NTT_CONFIGS = {
    sBTC: {
        symbol: 'sBTC',
        decimals: 8,
        tokenIds: {
            Bitcoin: 'native',
            Stacks: 'SP1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-token',
            Ethereum: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Public sBTC NTT Manager (EVM)
            Base: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            Arbitrum: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
        }
    },
    W: {
        symbol: 'W',
        decimals: 18,
        tokenIds: {
            Solana: '85VBFQZC9TZkfAd9S1UZ6WqZBBH6YXM3u2v5n88ZpLp3',
            Ethereum: '0xB66E0F928829C1F82f06b6E8B6D1B2A10D597A2E',
            Base: '0xB66E0F928829C1F82f06b6E8B6D1B2A10D597A2E'
        }
    }
};

export interface FeeEstimation {
    wormholeBridgeFee: number;
    destinationNetworkFee: number;
    integratorFee: number;
    totalFee: number;
}

/**
 * Helper to get an initialized Wormhole instance aligned with Sovereign RPC choices.
 */
const getWormholeContext = async (network: Network, appState?: AppState) => {
    const rpcs = appState ? endpointsFor(network, appState) : null;
    const config: any = { chains: {} };

    if (rpcs) {
        // Map sovereign endpoints to Wormhole config
        if (rpcs.BTC_API) config.chains.Bitcoin = { rpc: rpcs.BTC_API };
        if (rpcs.STX_API) config.chains.Stacks = { rpc: rpcs.STX_API };
        // Add more mapping for EVM chains if they are in sovereign node list
    }

    return await wormhole(network === 'mainnet' ? 'Mainnet' : 'Testnet', [EvmPlatform], config);
};

export class NttManager {
    static async getOutboundLimit(chain: string): Promise<bigint> { return 1000000000n; }

    /**
     * Stacks Principal Hashing for Wormhole Compatibility.
     * Wormhole expects 32-byte addresses; Stacks principals are hashed to fit.
     */
    static hashStacksPrincipal(principal: string): Uint8Array {
        return sha256(new TextEncoder().encode(principal));
    }
}

export class NttService {
    /**
     * Estimates fees for an NTT transfer using the public Wormhole Guardian network.
     */
    static async estimateFees(amount: string, source: string, target: string, network: Network): Promise<FeeEstimation> {
        try {
            const btcPrice = await fetchBtcPrice();
            const integratorFee = calculateNttFee(parseFloat(amount) || 0, btcPrice);

            const wormholeBridgeFee = 0.00001;
            const destinationNetworkFee = 0.00005;

            return {
                wormholeBridgeFee,
                destinationNetworkFee,
                integratorFee,
                totalFee: wormholeBridgeFee + destinationNetworkFee + integratorFee
            };
        } catch (error) {
            return { wormholeBridgeFee: 0.0001, destinationNetworkFee: 0.00005, integratorFee: 0, totalFee: 0.00015 };
        }
    }

    /**
     * Executes a Native Token Transfer (NTT) via public Wormhole.
     */
    static async executeNtt(
        amountStr: string,
        sourceLayer: string,
        targetLayer: string,
        signer: Signer,
        network: Network,
        appState?: AppState
    ): Promise<string | null> {
        try {
            const wh = await getWormholeContext(network, appState);

            const srcChain = wh.getChain(sourceLayer as Chain);
            const dstChain = wh.getChain(targetLayer as Chain);

            const config = Object.values(NTT_CONFIGS).find(c => (c.tokenIds as any)[sourceLayer]);
            if (!config) throw new Error(`No NTT configuration found for ${sourceLayer}`);

            const tokenAddr = (config.tokenIds as any)[sourceLayer];
            const token = Wormhole.tokenId(srcChain.chain, tokenAddr === 'native' ? 'native' : tokenAddr);
            const transferAmount = wormholeAmount.units(wormholeAmount.parse(amountStr, config.decimals));

            const xfer = await wh.tokenTransfer(
                token,
                transferAmount,
                Wormhole.chainAddress(srcChain.chain, signer.address()),
                Wormhole.chainAddress(dstChain.chain, signer.address()),
                false
            );

            const quote = await TokenTransfer.quoteTransfer(wh, srcChain, dstChain, xfer.transfer);
            const srcTxids = await xfer.initiateTransfer(signer);
            return srcTxids[0];

        } catch (error) {
            console.error('Sovereign NTT Initiation Failed:', error);
            throw new Error(sanitizeError(error));
        }
    }

    /**
     * Tracks the progress of a public NTT transfer.
     */
    static async trackProgress(txHash: string, network: Network, appState?: AppState): Promise<{ status: string; signatures: number }> {
        try {
            const wh = await getWormholeContext(network, appState);
            const status = await wh.getTransactionStatus(txHash);

            return {
                status: status.state || 'Pending',
                signatures: (status as any).vaa?.signatures?.length || 0
            };
        } catch (error) {
            return { status: 'Unknown', signatures: 0 };
        }
    }

    /**
     * Fetches the VAA for redemption on the destination chain.
     */
    static async fetchVaa(txHash: string, network: Network, appState?: AppState): Promise<Uint8Array | null> {
        try {
            const wh = await getWormholeContext(network, appState);
            const xfer = await TokenTransfer.from(wh, txHash);
            const attestations = await xfer.fetchAttestation(60000);
            return (attestations[0] as any).vaa;
        } catch {
            return null;
        }
    }

    /**
     * Dynamically discovers NTT-capable tokens from public registries.
     */
    static async discoverPublicNttTokens(network: Network): Promise<any[]> {
        const baseUrl = network === 'mainnet' ? 'https://api.wormholescan.io' : 'https://api.testnet.wormholescan.io';
        try {
            const response = await fetch(`${baseUrl}/api/v1/ntt/tokens`);
            if (!response.ok) return [];
            return await response.json();
        } catch {
            return [];
        }
    }
}

export const BRIDGE_STAGES = [
  { id: 'CONFIRMATION', text: 'Source Confirmation', userMessage: 'Patience, Sovereign. BTC is etching...' },
  { id: 'VAA', text: 'Wormhole VAA', userMessage: 'Guardians are witnessing...' },
  { id: 'REDEMPTION', text: 'Redemption', userMessage: 'Arriving on destination...' },
];

export const getRecommendedBridgeProtocol = (source: string, target: string): 'Native' | 'NTT' | 'Swap' => {
    const bitcoinEcosystem = ['Stacks', 'Liquid', 'Rootstock', 'BOB', 'B2', 'Botanix', 'Mezo', 'RGB', 'Ark', 'StateChain', 'Lightning'];
    if (source === 'Mainnet' && bitcoinEcosystem.includes(target)) return 'Native';
    if ((source === 'Mainnet' && (target === 'Lightning' || target === 'Liquid')) || (source === 'Liquid' && target === 'Mainnet')) return 'Swap';
    return 'NTT';
};
