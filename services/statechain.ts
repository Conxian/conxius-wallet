import { notificationService } from './notifications';
import { endpointsFor, fetchWithRetry } from './network';
import { Network } from '../types';
import * as bitcoin from 'bitcoinjs-lib';
import {
    createUnverifiedValueOperationRequest,
    createValueOperationNonce,
    executeValueOperation,
    requireValueOperationSignature,
} from './value-operation';

export interface StateChainUtxo {
    id: string;
    amount: number;
    lockTime: number;
    index: number;
    status: 'active' | 'transferring' | 'spent';
}

export interface StateChainTransferResult {
    nextIndex: number;
    signature: string;
    txid: string;
}

/**
 * State Chain Protocol Service (M5 Implementation)
 * Handles off-chain UTXO transfers via key-rotation.
 */

/**
 * Initiates a StateChain UTXO transfer.
 */
export const transferStateChainUtxo = async (
    utxoId: string,
    recipientPubkey: string,
    currentIndex: number,
    vault: string,
    network: Network = 'mainnet'
): Promise<StateChainTransferResult> => {
    notificationService.notify({ category: 'TRANSACTION', type: 'info', title: 'StateChain Transfer', message: `Initiating transfer for UTXO ${utxoId.slice(0, 8)}...` });

    try {
        // 1. Prepare Transfer Message Hash
        const msgHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from(utxoId + recipientPubkey + currentIndex))).toString("hex");

        // 2. Request Enclave Signature (Sequential Key Rotation Path)
        const signResult = requireValueOperationSignature(await executeValueOperation(
            createUnverifiedValueOperationRequest({
                operationType: 'transfer', chainLayer: 'StateChain',
                payload: { hash: msgHash, utxoId, recipientPubkey, index: currentIndex },
                network, purpose: 'statechain.transfer', nonce: createValueOperationNonce(),
                audience: 'conxius-wallet', keyIdentity: `wallet.statechain.index-${currentIndex}`,
                algorithm: 'secp256k1-schnorr', signingType: 'message',
                description: `Transfer StateChain UTXO to ${recipientPubkey.slice(0,12)}...`,
            }), vault, { userConfirmed: true },
        ));

        // 3. Notify Coordinator
        const { STATE_CHAIN_API } = endpointsFor(network);
        if (!STATE_CHAIN_API) throw new Error('STATECHAIN_COORDINATOR_UNSUPPORTED: authoritative endpoint unavailable');
        const response = await fetchWithRetry(`${STATE_CHAIN_API}/v1/transfer`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ utxoId, recipientPubkey, signature: signResult.signature, index: currentIndex })
        });
        if (!response.ok) throw new Error('StateChain coordinator rejected transfer');
        const data = await response.json();
        if (typeof data.txid !== 'string' || !data.txid) throw new Error('StateChain coordinator returned no authoritative receipt ID');

        notificationService.notify({ category: 'TRANSACTION', type: 'success', title: 'StateChain Transfer', message: `UTXO ${utxoId.slice(0, 8)} transferred` });

        return { 
            nextIndex: currentIndex + 1, 
            signature: signResult.signature,
            txid: data.txid
        };
    } catch (e: any) {
        console.error('StateChain Transfer Failed', e);
        notificationService.notify({ category: 'TRANSACTION', type: 'error', title: 'StateChain Transfer', message: `Transfer failed: ${e.message}` });
        throw e;
    }
};

/**
 * Withdraws a StateChain UTXO to Bitcoin L1.
 */
export const withdrawStateChainUtxo = async (
    utxoId: string,
    destAddress: string,
    vault: string,
    network: Network = 'mainnet'
): Promise<string> => {
    notificationService.notify({ category: 'TRANSACTION', type: 'info', title: 'StateChain Withdrawal', message: 'Initiating exit to L1...' });

    try {
        const msgHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from("withdraw:" + utxoId + destAddress))).toString("hex");

        const signResult = requireValueOperationSignature(await executeValueOperation(
            createUnverifiedValueOperationRequest({
                operationType: 'withdraw', chainLayer: 'StateChain',
                payload: { hash: msgHash, utxoId, destAddress }, network,
                purpose: 'statechain.withdraw', nonce: createValueOperationNonce(),
                audience: 'conxius-wallet', keyIdentity: 'wallet.statechain.current',
                algorithm: 'secp256k1-schnorr', signingType: 'message',
                description: `Withdraw StateChain UTXO to ${destAddress}`,
            }), vault, { userConfirmed: true },
        ));

        const { STATE_CHAIN_API } = endpointsFor(network);
        if (!STATE_CHAIN_API) throw new Error('STATECHAIN_WITHDRAWAL_UNSUPPORTED: authoritative endpoint unavailable');
        const response = await fetchWithRetry(`${STATE_CHAIN_API}/v1/withdraw`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ utxoId, destAddress, signature: signResult.signature })
        });
        if (!response.ok) throw new Error('StateChain coordinator rejected withdrawal');
        const data = await response.json();
        if (typeof data.txid !== 'string' || !data.txid) throw new Error('StateChain coordinator returned no authoritative withdrawal transaction ID');

        notificationService.notify({ category: 'TRANSACTION', type: 'success', title: 'StateChain Withdrawal', message: 'Withdrawal Broadcasted to L1' });
        return data.txid;

    } catch (e: any) {
        notificationService.notify({ category: 'TRANSACTION', type: 'error', title: 'StateChain Withdrawal', message: `Withdrawal failed: ${e.message}` });
        throw e;
    }
};
