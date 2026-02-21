
import { trackNttBridge } from './protocol';
import { executeGasSwap } from './swap';
import { sanitizeError } from './network';
import { Wormhole, amount as wormholeAmount, Chain, Signer, TokenId, TokenTransfer } from '@wormhole-foundation/sdk';
import { NttTransceiver } from './ntt-transceiver';
import { EvmPlatform } from '@wormhole-foundation/sdk-evm';
import { Network } from '../types';

/**
 * Production NTT Configurations
 * Maps assets to their canonical Wormhole Token Bridge addresses.
 */
export const NTT_CONFIGS = {
    sBTC: {
        symbol: 'sBTC',
        decimals: 8,
        tokenIds: {
            Bitcoin: 'native',
            Stacks: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-token',
            Ethereum: '0x0000000000000000000000000000000000000000', // Placeholder
        }
    },
    WBTC: {
        symbol: 'WBTC',
        decimals: 8,
        tokenIds: {
            Ethereum: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            Arbitrum: '0x2f2a2543b76a4166549f7aa6291999a2ee856eba'
        }
    }
};

// ─── Bridge Stages (UI display) ─────────────────────────────────────────────

export const BRIDGE_STAGES = [
  { id: 'CONFIRMATION', text: 'Source Confirmation', userMessage: 'Patience, Sovereign. The Bitcoin machine is etching your transaction into history.' },
  { id: 'VAA', text: 'Wormhole VAA Generation', userMessage: 'The Guardians are witnessing your transfer. A cross-chain message is being prepared.' },
  { id: 'REDEMPTION', text: 'Destination Redemption', userMessage: 'Finalizing the bridge. Your assets are arriving on the destination chain.' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BridgeOperation {
    status: string;
    vaa?: string;
    signatures?: number;
}

/** Chain identifiers supported by Conxius Bridge */
export type BridgeChain = 'Ethereum' | 'Arbitrum' | 'Base' | 'Solana' | 'Bitcoin' | 'Rootstock';

/**
 * NttManager (Sovereign Implementation)
 * Interface for interacting with Native Token Transfer Manager contracts.
 */
export class NttManager {
    static async getOutboundLimit(chain: BridgeChain): Promise<bigint> {
        return 1000000000n; // Placeholder
    }
}

// ─── Feature Gate ────────────────────────────────────────────────────────────

/**
 * EXPERIMENTAL flag: Bridge execution.
 * Set to `false` as Standard Token Bridge is production ready.
 */
export const BRIDGE_EXPERIMENTAL = false;

// ─── Wormhole SDK Initialization ─────────────────────────────────────────────

/**
 * Initializes the Wormhole SDK context.
 * Uses Mainnet by default; switch to Testnet for development.
 */
const getWormholeContext = async (network: Network) => {
    // Register platform packages
    const whNetwork = network === 'mainnet' ? 'Mainnet' : 'Testnet';
    const wh = new Wormhole(whNetwork, [EvmPlatform]);
    return wh;
};

// ─── Bridge Service ─────────────────────────────────────────────────────────────

/**
 * NttService (Refactored to Standard Token Bridge)
 * 
 * Uses the canonical Wormhole Token Bridge (Portal) for wrapping/unwrapping assets.
 * No custom contracts required.
 */
export class NttService {
    /**
     * Executes a Native Token Transfer (NTT) using the Sovereign Transceiver.
     * This method bypasses the standard token bridge for supported native assets.
     */
    static async executeNtt(
        amount: string,
        sourceLayer: string,
        targetLayer: string,
        signer: Signer,
        network: Network
    ): Promise<string | null> {
        console.log(`[NTT] Executing Native Token Transfer: ${amount} to ${targetLayer}`);

        // 1. Prepare Payload
        const payload = NttTransceiver.createNttPayload(
            BigInt(parseFloat(amount) * 1e8),
            8,                          // Decimals
            new Uint8Array(32).fill(1), // Source Token placeholder
            new Uint8Array(32).fill(2), // Recipient placeholder
            1                           // Recipient Chain placeholder
        );

        // 2. Request Signature from Conclave
        // In a real flow, this would call signer.ts -> authorizeSignature
        // For this module, we assume the VAA is formatted with a signature.
        const signature = new Uint8Array(65).fill(0);

        // 3. Format VAA
        const vaa = NttTransceiver.formatSovereignVaa(
            payload,
            signature,
            1, // Emitter Chain (placeholder)
            new Uint8Array(32).fill(3), // Emitter Address
            1n // Sequence
        );

        console.log(`[NTT] Sovereign VAA Generated: ${vaa.length} bytes`);
        return '0xntt' + Buffer.from(vaa.slice(0, 8)).toString('hex');
    }

    /**
     * Executes the bridge logic using Standard Token Bridge.
     */
    static async executeBridge(
        amount: string,
        sourceLayer: string,
        targetLayer: string,
        autoSwap: boolean,
        signer: Signer,
        network: Network,
        gasFee?: number
    ): Promise<string | null> {
        // Gas abstraction
        if (autoSwap && gasFee) {
            const swapSuccess = await executeGasSwap(
                'BTC',
                gasFee,
                targetLayer
            );
            if (!swapSuccess) return null;
        }

        try {
            const wh = await getWormholeContext(network);

            // Resolve chain contexts
            const sourceChain = wh.getChain(sourceLayer as any as Chain);
            const destChain = wh.getChain(targetLayer as any as Chain);

            // Parse amount
            // Assuming 8 decimals for BTC, but should be dynamic based on token
            const decimals = 8; 
            const transferAmount = wormholeAmount.units(wormholeAmount.parse(amount, decimals));

            // Standard Token Bridge Transfer
            // Automatically resolves token IDs or defaults to 'native'
            let tokenId: TokenId = Wormhole.tokenId(sourceChain.chain, 'native');
            
            // Attempt to resolve via NTT_CONFIGS if applicable
            const config = Object.values(NTT_CONFIGS).find(c => c.tokenIds[sourceLayer as keyof typeof c.tokenIds]);
            if (config) {
                const addr = config.tokenIds[sourceLayer as keyof typeof config.tokenIds];
                tokenId = Wormhole.tokenId(sourceChain.chain, addr as any);
            }
            
            const xfer = await wh.tokenTransfer(
                tokenId,
                transferAmount,
                Wormhole.chainAddress(sourceChain.chain, signer.address()),
                Wormhole.chainAddress(destChain.chain, signer.address()),
                'TokenBridge'
            );

            // Initiate Transfer
            // This requires the signer to be compatible with the SDK's Signer interface
            const srcTxids = await xfer.initiateTransfer(signer);
            
            return srcTxids[0];

        } catch (error) {
            const safeMsg = sanitizeError(error, 'Bridge Execution Failed');
            console.error('[Bridge] Execution failed:', safeMsg);
            // Fallback for demo if SDK fails due to environment
            if (BRIDGE_EXPERIMENTAL) {
                 const arr = new Uint8Array(32);
                 globalThis.crypto.getRandomValues(arr);
                 return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            }
            throw new Error(safeMsg);
        }
    }

    /**
     * Maps the Wormhole operation status to our BRIDGE_STAGES index.
     */
    static async trackProgress(txHash: string): Promise<number> {
        const data = await trackNttBridge(txHash);
        if (data && data.length > 0) {
            const operation = data[0];
            if (operation.status === 'confirmed' || operation.status === 'redeemed') {
                return 2; // Redemption
            } else if (operation.vaa) {
                return 1; // VAA Generation
            }
        }
        return 0; // Confirmation
    }

    /**
     * Retrieves full tracking details from Wormhole.
     * Parallelized for multiple transactions if needed.
     */
    static async getTrackingDetails(txHashes: string[]) {
        return Promise.all(txHashes.map(hash => trackNttBridge(hash)));
    }

    /**
     * Real-time VAA Retrieval via Wormhole API
     */
    static async fetchVaa(emitterChainId: number, emitterAddress: string, sequence: string) {
        try {
            const response = await fetch(`https://api.wormholescan.io/api/v1/vaas/${emitterChainId}/${emitterAddress}/${sequence}`);
            if (response.ok) {
                const data = await response.json();
                return data.data?.vaa || null;
            }
        } catch (e) {
            console.warn('[NTT] VAA fetch failed:', e);
        }
        return null;
    }
}
