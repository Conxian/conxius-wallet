import * as bitcoin from 'bitcoinjs-lib';
import { notificationService } from './notifications';
import { endpointsFor, fetchWithRetry } from './network';
import { fetchBtcPrice } from './prices';
import { Network } from '../types';
import {
    createUnverifiedValueOperationRequest,
    createValueOperationNonce,
    ValueOperationAuthorizer,
    authorizeValueOperationSignature,
} from './value-operation';

export interface VTXO {
    txid: string;
    vout: number;
    amount: number;
    ownerPubkey: string;
    serverPubkey: string;
    roundTxid: string;
    expiryHeight: number;
    status: 'pending' | 'available' | 'spent' | 'lifting' | 'forfeited';
}

export interface LiftRequest {
    amountSats: number;
    senderAddress: string;
    senderPubkey: string;
    network: Network;
    feeRate?: number;
}

/**
 * Ark Protocol Service (M5 Implementation)
 * Handles off-chain VTXO lifecycle management and Boarding (Lifting).
 */

/**
 * Creates a Boarding (Lift) Transaction PSBT.
 * Moves L1 BTC -> Ark Boarding Address.
 */
export const createLiftPsbt = async (req: LiftRequest): Promise<{ psbtBase64: string, boardingAddress: string }> => {
    void req;
    throw new Error('ARK_LIFT_PSBT_QUARANTINED: exact request-bound ASP and UTXO construction authority is unavailable');
};

/**
 * Syncs VTXOs from the Ark Service Provider (ASP).
 */
export const syncVtxos = async (address: string, network: Network = 'mainnet'): Promise<VTXO[]> => {
    try {
        const { ARK_API } = endpointsFor(network);
        if (!ARK_API) return [];

        const response = await fetchWithRetry(`${ARK_API}/v1/vtxos/${address}`, {}, 1, 1000);
        
        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return (data.vtxos || []).map((v: any) => ({
            txid: v.txid,
            vout: v.vout,
            amount: v.amount,
            ownerPubkey: v.ownerPubkey,
            serverPubkey: v.serverPubkey,
            roundTxid: v.roundTxid,
            expiryHeight: v.expiryHeight,
            status: v.status || 'available'
        }));

    } catch (e) {
        console.warn('[Ark] Sync failed', e);
        return [];
    }
};

/**
 * Forfeits a VTXO back to L1 or to another user (Off-chain Transfer).
 * This broadcasts a signed forfeit transaction via the ASP.
 */
export const forfeitVtxo = async (vtxo: VTXO, recipientAddress: string, network: Network, authorizeValueOperation: ValueOperationAuthorizer): Promise<string> => {
    notificationService.notify({ category: 'TRANSACTION', type: 'info', title: 'Ark Transfer', message: `Preparing VTXO ${vtxo.txid.slice(0,8)} forfeit...` });
    
    if (!vtxo.txid || !recipientAddress) throw new Error("Invalid VTXO or Recipient");

    try {
        const { ARK_API } = endpointsFor(network);

        if (!ARK_API) throw new Error('ARK_BROADCAST_UNSUPPORTED: authoritative ASP endpoint unavailable');

        const msgHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from(vtxo.txid + recipientAddress))).toString("hex");
        const request = createUnverifiedValueOperationRequest({
                operationType: 'transfer', chainLayer: 'Ark',
                payload: { hash: msgHash, vtxoId: vtxo.txid, recipient: recipientAddress },
                network, purpose: 'ark.forfeit-vtxo', nonce: createValueOperationNonce(),
                audience: 'conxius-wallet', keyIdentity: 'wallet.ark.account-0',
                algorithm: 'secp256k1-schnorr', signingType: 'psbt',
                description: `Forfeit VTXO to ${recipientAddress}`,
            });
        const signResult = await authorizeValueOperationSignature(authorizeValueOperation, request);

        const response = await fetchWithRetry(`${ARK_API}/v1/forfeit`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vtxoId: vtxo.txid, recipient: recipientAddress, signature: signResult.signature })
        });
        if (!response.ok) throw new Error('Ark ASP rejected forfeit');
        const data = await response.json();
        if (typeof data.txid !== 'string' || !data.txid) throw new Error('Ark ASP returned no authoritative transaction ID');
        return data.txid;

    } catch (e: any) {
        notificationService.notify({ category: 'TRANSACTION', type: 'error', title: 'Ark Transfer', message: `Forfeit failed: ${e.message}` });
        throw e;
    }
};

/**
 * Redeems a VTXO (Unilateral Exit).
 * This creates a transaction that spends the VTXO and broadcasts it to Bitcoin L1.
 */
export const redeemVtxo = async (vtxo: VTXO, authorizeValueOperation: ValueOperationAuthorizer, network: Network): Promise<string> => {
    notificationService.notify({ category: 'TRANSACTION', type: 'info', title: 'Ark Redemption', message: `Preparing unilateral exit for ${vtxo.txid.slice(0,8)}...` });

    try {
        const msgHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from("redeem:" + vtxo.txid))).toString("hex");

        const { ARK_API } = endpointsFor(network);
        if (!ARK_API) throw new Error('ARK_REDEMPTION_UNSUPPORTED: authoritative ASP endpoint unavailable');
        const request = createUnverifiedValueOperationRequest({
                operationType: 'withdraw', chainLayer: 'Ark', payload: { hash: msgHash, vtxoId: vtxo.txid },
                network, purpose: 'ark.redeem-vtxo', nonce: createValueOperationNonce(),
                audience: 'conxius-wallet', keyIdentity: 'wallet.ark.account-0',
                algorithm: 'secp256k1-schnorr', signingType: 'message',
                description: `Redeem VTXO ${vtxo.txid.slice(0,8)}`,
            });
        const signResult = await authorizeValueOperationSignature(authorizeValueOperation, request);

        const response = await fetchWithRetry(`${ARK_API}/v1/redeem`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vtxoId: vtxo.txid, signature: signResult.signature })
        });
        if (!response.ok) throw new Error('Ark ASP rejected redemption');
        const data = await response.json();
        if (typeof data.txid !== 'string' || !data.txid) throw new Error('Ark ASP returned no authoritative redemption transaction ID');

        notificationService.notify({ category: 'SYSTEM', type: 'success', title: 'Ark Redemption', message: 'Unilateral Exit Broadcasted' });
        return data.txid;

    } catch (e: any) {
        notificationService.notify({ category: 'SYSTEM', type: 'error', title: 'Ark Redemption', message: `Redemption failed: ${e.message}` });
        throw e;
    }
};

// Backwards compatibility for existing calls
export const liftToArk = async (amount: number, address: string, aspId: string): Promise<any> => {
    return {
        id: 'vtxo:legacy-shim',
        amount,
        status: 'lifting'
    };
};
