import { Buffer } from 'buffer';
import { Chain, TokenId, Wormhole, amount as wormholeAmount, Signer } from '@wormhole-foundation/sdk';
import { NttTransceiver } from './ntt-transceiver';
import { EvmPlatform } from '@wormhole-foundation/sdk-evm';
import { Network } from '../types';
import { sha256 } from '@noble/hashes/sha2.js';
import { sanitizeError } from './network';
import { calculateNttFee } from './monetization';
import { fetchBtcPrice } from './protocol';

export const NTT_CONFIGS = {
    sBTC: { symbol: 'sBTC', decimals: 8, tokenIds: { Bitcoin: 'native', Stacks: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-token', Ethereum: '0x0', } },
    WBTC: { symbol: 'WBTC', decimals: 8, tokenIds: { Ethereum: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', Arbitrum: '0x2f2a2543b76a4166549f7aa6291999a2ee856eba' } }
};

export const BRIDGE_STAGES = [
  { id: 'CONFIRMATION', text: 'Source Confirmation', userMessage: 'Patience, Sovereign. BTC is etching...' },
  { id: 'VAA', text: 'Wormhole VAA', userMessage: 'Guardians are witnessing...' },
  { id: 'REDEMPTION', text: 'Redemption', userMessage: 'Arriving on destination...' },
];

export interface BridgeOperation { status: string; vaa?: string; signatures?: number; }
export interface FeeEstimation { wormholeBridgeFee: number; destinationNetworkFee: number; integratorFee: number; totalFee: number; }
export type BridgeChain = 'Ethereum' | 'Arbitrum' | 'Base' | 'Solana' | 'Bitcoin' | 'Rootstock';

export class NttManager {
    static async getOutboundLimit(chain: BridgeChain): Promise<bigint> { return 1000000000n; }
    static hashStacksPrincipal(principal: string): Uint8Array { return sha256(new TextEncoder().encode(principal)); }
}

const getWormholeContext = async (network: Network) => new Wormhole(network === 'mainnet' ? 'Mainnet' : 'Testnet', [EvmPlatform]);

export class NttService {
    static async estimateFees(amount: string, source: string, target: string, network: Network): Promise<FeeEstimation> {
        const btcPrice = await fetchBtcPrice();
        const integratorFee = calculateNttFee(parseFloat(amount) || 0, btcPrice);
        return { wormholeBridgeFee: 0.0001, destinationNetworkFee: 0.00005, integratorFee, totalFee: 0.0001 + 0.00005 + integratorFee };
    }
    static async executeNtt(amount: string, sourceLayer: string, targetLayer: string, signer: Signer, network: Network): Promise<string | null> {
        let sourceTokenAddr: any = new Uint8Array(32).fill(1);
        const config = Object.values(NTT_CONFIGS).find(c => c.symbol === 'sBTC');
        if (config && sourceLayer === 'Stacks' && 'Stacks' in config.tokenIds) {
            sourceTokenAddr = NttManager.hashStacksPrincipal((config.tokenIds as any).Stacks);
        }
        const payload = NttTransceiver.createNttPayload(BigInt(parseFloat(amount) * 1e8), 8, sourceTokenAddr as any, new Uint8Array(32).fill(2), 1);
        const vaa = NttTransceiver.formatSovereignVaa(payload, new Uint8Array(65).fill(0), 1, new Uint8Array(32).fill(3), 1n);
        return '0xntt' + Buffer.from(vaa.slice(0, 8)).toString('hex');
    }
    static async executeBridge(amount: string, sourceLayer: string, targetLayer: string, autoSwap: boolean, signer: Signer, network: Network, gasFee?: number): Promise<string | null> {
        try {
            const wh = await getWormholeContext(network);
            const sourceChain = wh.getChain(sourceLayer as any as Chain);
            const destChain = wh.getChain(targetLayer as any as Chain);
            const transferAmount = wormholeAmount.units(wormholeAmount.parse(amount, 8));
            let tokenId: TokenId = Wormhole.tokenId(sourceChain.chain, 'native');
            const config = Object.values(NTT_CONFIGS).find(c => (c.tokenIds as any)[sourceLayer]);
            if (config) tokenId = Wormhole.tokenId(sourceChain.chain, (config.tokenIds as any)[sourceLayer] as any);
            const xfer = await (wh as any).tokenTransfer(tokenId, transferAmount, Wormhole.chainAddress(sourceChain.chain, signer.address()), Wormhole.chainAddress(destChain.chain, signer.address()), 'TokenBridge');
            const srcTxids = await xfer.initiateTransfer(signer);
            return srcTxids[0];
        } catch (error) { throw new Error(sanitizeError(error)); }
    }
    static async trackProgress(txHash: string): Promise<number> { return 0; }
    static async getTrackingDetails(txHashes: string[]) { return []; }
    static async fetchVaa(emitterChainId: number, emitterAddress: string, sequence: string) { return null; }
}

export const getRecommendedBridgeProtocol = (source: string, target: string): 'Native' | 'NTT' | 'Swap' => {
    const bitcoinEcosystem = ['Stacks', 'Liquid', 'Rootstock', 'BOB', 'B2', 'Botanix', 'Mezo', 'RGB', 'Ark', 'StateChain', 'Lightning'];
    if (source === 'Mainnet' && bitcoinEcosystem.includes(target)) return 'Native';
    if ((source === 'Mainnet' && (target === 'Lightning' || target === 'Liquid')) || (source === 'Liquid' && target === 'Mainnet')) return 'Swap';
    return 'NTT';
};
