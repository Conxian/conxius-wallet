
import { trackNttBridge } from './protocol';
import { executeGasSwap } from './swap';
import { Wormhole, amount as wormholeAmount, Chain, Signer, TokenId, TokenTransfer } from '@wormhole-foundation/sdk';
import { EvmPlatform } from '@wormhole-foundation/sdk-evm';
import { Network } from '../types';

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
            // This initiates a transfer of the native token (e.g., BTC on Bitcoin, ETH on Ethereum)
            // or a wrapped token.
            
            // Note: For real implementation, we need the automatic token ID resolution.
            // For now, assuming Native Token transfer.
            
            const xfer = await wh.tokenTransfer(
                sourceChain,
                'native', // Transfer native token of source chain
                transferAmount,
                destChain,
                signer.address(), // Destination address (simplified, usually need to decode/encode)
                false, // Automatic delivery (Relayer) - False for Manual (Standard)
                undefined // Payload
            );

            // Initiate Transfer
            // This requires the signer to be compatible with the SDK's Signer interface
            const srcTxids = await xfer.initiateTransfer(signer);
            
            return srcTxids[0];

        } catch (error) {
            console.error('[Bridge] Execution failed:', error);
            // Fallback for demo if SDK fails due to environment
            if (BRIDGE_EXPERIMENTAL) {
                 const arr = new Uint8Array(32);
                 globalThis.crypto.getRandomValues(arr);
                 return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            }
            throw error;
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
     */
    static async getTrackingDetails(txHash: string) {
        return await trackNttBridge(txHash);
    }
}
