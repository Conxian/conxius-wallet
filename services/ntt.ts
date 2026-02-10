
import { trackNttBridge } from './protocol';
import { executeGasSwap } from './swap';
import { Wormhole, amount as wormholeAmount } from '@wormhole-foundation/sdk';

// ─── Bridge Stages (UI display) ─────────────────────────────────────────────

export const BRIDGE_STAGES = [
  { id: 'CONFIRMATION', text: 'Source Confirmation', userMessage: 'Patience, Sovereign. The Bitcoin machine is etching your transaction into history.' },
  { id: 'VAA', text: 'Wormhole VAA Generation', userMessage: 'The Guardians are witnessing your transfer. A cross-chain message is being prepared.' },
  { id: 'REDEMPTION', text: 'Destination Redemption', userMessage: 'Finalizing the bridge. Your assets are arriving on Rootstock.' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NttOperation {
    status: string;
    vaa?: string;
    signatures?: number;
}

/** Chain identifiers supported by Conxius NTT bridge */
export type NttChain = 'Ethereum' | 'Arbitrum' | 'Base' | 'Solana';

export interface NttConfig {
    /** Wormhole NTT manager contract address on source chain */
    sourceNttManager: string;
    /** Wormhole NTT manager contract address on destination chain */
    destNttManager: string;
    /** Token address on source chain */
    sourceToken: string;
    /** Token address on destination chain */
    destToken: string;
}

// ─── Feature Gate ────────────────────────────────────────────────────────────

/**
 * EXPERIMENTAL flag: NTT bridge is not yet connected to real Wormhole contracts.
 * Set to `false` only after:
 * 1. Wormhole SDK platform packages installed (@wormhole-foundation/sdk-evm, etc.)
 * 2. NTT Manager contracts deployed on source and destination chains
 * 3. NTT config populated below with real contract addresses
 * 4. End-to-end bridge flow tested on testnet
 */
export const NTT_EXPERIMENTAL = true;

/**
 * NTT contract configuration per chain pair.
 * TODO: Populate with real contract addresses after deployment.
 */
const NTT_CONFIGS: Record<string, NttConfig> = {
    // Example: 'Ethereum->Arbitrum': { sourceNttManager: '0x...', destNttManager: '0x...', sourceToken: '0x...', destToken: '0x...' }
};

// ─── Wormhole SDK Initialization ─────────────────────────────────────────────

/**
 * Initializes the Wormhole SDK context.
 * Uses Mainnet by default; switch to Testnet for development.
 * Platform-specific packages (e.g. @wormhole-foundation/sdk-evm) must be
 * installed and registered for the chains you want to support.
 */
const getWormholeContext = async () => {
    // Dynamic import of platform packages — these must be installed separately
    // e.g. npm install @wormhole-foundation/sdk-evm @wormhole-foundation/sdk-solana
    // For now, initialize with base context only
    const wh = new Wormhole('Mainnet', []);
    return wh;
};

// ─── NTT Service ─────────────────────────────────────────────────────────────

/**
 * NttService - Sovereign NTT Transceiver Logic
 *
 * Architecture:
 * 1. Payload preparation happens here (source chain, amount, destination)
 * 2. Signing is deferred to the Conclave (SecureEnclave) via signer adapter
 * 3. Wormhole Guardian network witnesses the transfer and produces a VAA
 * 4. VAA is redeemed on the destination chain
 *
 * When NTT_EXPERIMENTAL is true, executeBridge returns a mock hash.
 * When false, it uses the Wormhole SDK to initiate a real transfer.
 */
export class NttService {
    /**
     * Executes the bridge logic, including gas abstraction if enabled.
     *
     * Real flow (when NTT_EXPERIMENTAL = false):
     * 1. Resolve NTT config for source→target pair
     * 2. Initialize Wormhole SDK with platform packages
     * 3. Create NTT transfer via Wormhole SDK
     * 4. Return source chain transaction hash for tracking
     *
     * Mock flow (when NTT_EXPERIMENTAL = true):
     * Returns a fake transaction hash. No on-chain action occurs.
     */
    static async executeBridge(
        amount: string,
        sourceLayer: string,
        targetLayer: string,
        autoSwap: boolean,
        gasFee?: number
    ): Promise<string | null> {
        // Gas abstraction (experimental, runs regardless of NTT flag)
        if (autoSwap && gasFee) {
            const swapSuccess = await executeGasSwap(
                'BTC',
                gasFee,
                targetLayer
            );
            if (!swapSuccess) return null;
        }

        // ── Experimental Mock Path ──
        if (NTT_EXPERIMENTAL) {
            console.warn(
                '[NTT] EXPERIMENTAL: Bridge execution is mocked. ' +
                'This is NOT a real cross-chain transfer. ' +
                'Install platform packages and configure NTT contracts to enable real transfers.'
            );
            const arr = new Uint8Array(32);
            globalThis.crypto.getRandomValues(arr);
            const mockTxHash = '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            return mockTxHash;
        }

        // ── Real Wormhole NTT Path ──
        const configKey = `${sourceLayer}->${targetLayer}`;
        const config = NTT_CONFIGS[configKey];
        if (!config) {
            throw new Error(`[NTT] No NTT config found for route: ${configKey}. Deploy NTT contracts first.`);
        }

        try {
            const wh = await getWormholeContext();

            // Resolve chain contexts
            const sourceChain = wh.getChain(sourceLayer as NttChain);
            const destChain = wh.getChain(targetLayer as NttChain);

            // Parse amount using Wormhole SDK utilities
            const transferAmount = wormholeAmount.units(wormholeAmount.parse(amount, 18));

            // TODO: When platform packages are installed, create NTT transfer:
            //
            // import { ntt } from '@wormhole-foundation/sdk';
            //
            // const xfer = await ntt.transfer(
            //   sourceChain,
            //   { address: config.sourceNttManager },
            //   { address: config.sourceToken },
            //   transferAmount,
            //   destChain,
            //   { address: destAddress },  // from signer/enclave
            //   signer,  // Conclave signer adapter
            // );
            //
            // const srcTxids = await xfer.initiateTransfer(signer);
            // return srcTxids[0];

            throw new Error(
                '[NTT] Real transfer path not yet implemented. ' +
                'Platform packages (@wormhole-foundation/sdk-evm) and signer adapter required.'
            );
        } catch (error) {
            console.error('[NTT] Bridge execution failed:', error);
            throw error;
        }
    }

    /**
     * Maps the Wormhole operation status to our BRIDGE_STAGES index.
     * 0 = Source Confirmation, 1 = VAA Generation, 2 = Destination Redemption
     */
    static async trackProgress(txHash: string): Promise<number> {
        const data = await trackNttBridge(txHash);
        if (data && data.length > 0) {
            const operation = data[0];
            if (operation.status === 'confirmed') {
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
