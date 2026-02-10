
import { trackNttBridge } from './protocol';
import { executeGasSwap } from './swap';

export const BRIDGE_STAGES = [
  { id: 'CONFIRMATION', text: 'Source Confirmation', userMessage: 'Patience, Sovereign. The Bitcoin machine is etching your transaction into history.' },
  { id: 'VAA', text: 'Wormhole VAA Generation', userMessage: 'The Guardians are witnessing your transfer. A cross-chain message is being prepared.' },
  { id: 'REDEMPTION', text: 'Destination Redemption', userMessage: 'Finalizing the bridge. Your assets are arriving on Rootstock.' },
];

export interface NttOperation {
    status: string;
    vaa?: string;
    signatures?: number;
}

/**
 * NttService - Sovereign NTT Transceiver Logic
 *
 * EXPERIMENTAL: Bridge execution is mocked. Real Wormhole NTT integration pending.
 * DO NOT use for real cross-chain transfers until Wormhole SDK is integrated.
 *
 * Logic Isolation: Functions as a "messenger" that prepares payloads
 * for the Conclave, rather than an independent signing entity.
 */
export const NTT_EXPERIMENTAL = true;

export class NttService {
    /**
     * Executes the bridge logic, including gas abstraction if enabled.
     * WARNING: Returns mock transaction hash — not a real on-chain transaction.
     */
    static async executeBridge(
        amount: string,
        sourceLayer: string,
        targetLayer: string,
        autoSwap: boolean,
        gasFee?: number
    ): Promise<string | null> {
        if (NTT_EXPERIMENTAL) {
            console.warn('[NTT] EXPERIMENTAL: Bridge execution is mocked. This is NOT a real cross-chain transfer.');
        }

        if (autoSwap && gasFee) {
            const swapSuccess = await executeGasSwap(
                'BTC',
                gasFee,
                targetLayer
            );
            if (!swapSuccess) return null;
        }

        // Logic Isolation: Payload preparation happens here.
        // Signing is deferred to the Conclave (SecureEnclave) in the UI or lower level service.
        // EXPERIMENTAL: Returns mock hash — real Wormhole SDK integration required.
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        return mockTxHash;
    }

    /**
     * Maps the Wormhole operation status to our BRIDGE_STAGES index.
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
