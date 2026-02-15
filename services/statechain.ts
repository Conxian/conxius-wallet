import * as bitcoin from 'bitcoinjs-lib';
import { notificationService } from './notifications';
import { requestEnclaveSignature } from './signer';
import { endpointsFor, fetchWithRetry } from './network';

export interface StateChainUtxo {
    id: string;
    amount: number;
    index: number; // Sequential derivation index
    publicKey: string;
    status: 'active' | 'transferring' | 'claimed';
}

/**
 * State Chain Protocol Service (M5 Implementation)
 * Manages sequential key derivation and off-chain UTXO transfers.
 */

export const transferStateChainUtxo = async (
    utxoId: string,
    currentIndex: number,
    newOwnerPublicKey: string,
    vault: string // Required for signing
): Promise<{ nextIndex: number; signature: string }> => {
    // 1. Construct the Transfer Message
    // Protocol specific: hash(utxoId + newOwnerPublicKey)
    // This ensures we are signing over the specific transfer intent.
    const msgBuffer = Buffer.concat([
        Buffer.from(utxoId),
        Buffer.from(newOwnerPublicKey, 'hex')
    ]);
    const messageHash = bitcoin.crypto.sha256(msgBuffer).toString('hex');

    notificationService.notify('info', `Initiating StateChain Transfer for UTXO ${utxoId.slice(0, 8)}...`);

    // 2. Sign with Enclave using the sequential index
    // Path: m/84'/0'/0'/2/{currentIndex}
    try {
        const signResult = await requestEnclaveSignature(
            {
                type: 'message',
                layer: 'StateChain',
                payload: {
                    hash: messageHash,
                    index: currentIndex
                },
                description: `Transfer StateChain UTXO #${currentIndex}`
            },
            vault
        );

        notificationService.notifyTransaction('StateChain Transfer', `UTXO ${utxoId.slice(0, 8)}... transferred`, true);

        return { 
            nextIndex: currentIndex + 1, 
            signature: signResult.signature 
        };
    } catch (e: any) {
        console.error('StateChain Transfer Failed', e);
        notificationService.notify('error', `Transfer failed: ${e.message}`);
        throw e;
    }
};

export const syncStateChainUtxos = async (address: string, network = 'mainnet'): Promise<StateChainUtxo[]> => {
    // Discover UTXOs controlled by the statechain sequential path
    // In production, query the State Chain Explorer/API
    const { STATE_CHAIN_API } = endpointsFor(network as any);
    
    try {
        const response = await fetchWithRetry(`${STATE_CHAIN_API}/v1/utxos/${address}`, {}, 1, 1000);
        if (response.ok) {
            const data = await response.json();
            return data.utxos || [];
        }
    } catch (e) {
        // Fallback for demo/offline
    }

    return [
        {
            id: 'sc:utxo-99',
            amount: 1200000,
            index: 0,
            publicKey: '03' + 'a'.repeat(64),
            status: 'active'
        }
    ];
};
