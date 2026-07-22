import { requestEnclaveSignature } from './signer';
import * as bitcoin from 'bitcoinjs-lib';
import { notificationService } from './notifications';
import { endpointsFor, fetchWithRetry } from './network';
import { fetchUtxos } from './protocol';
import { fetchBtcPrice } from './prices';
import { Network, UTXO } from '../types';
import { estimateVbytes } from './psbt';

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

const isNonEmptyString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null
);

const confirmedTxid = async (response: Response, operation: string): Promise<string> => {
    if (!response.ok) {
        throw new Error(`${operation} rejected by the Ark service provider${response.status ? ` (HTTP ${response.status})` : ''}`);
    }

    const data: unknown = await response.json();
    if (!isRecord(data) || !isNonEmptyString(data.txid)) {
        throw new Error(`${operation} response did not include a confirmed transaction id`);
    }

    return data.txid.trim();
};

/**
 * Ark Protocol Service (M5 Implementation)
 * Handles off-chain VTXO lifecycle management and Boarding (Lifting).
 */

/**
 * Creates a Boarding (Lift) Transaction PSBT.
 * Moves L1 BTC -> Ark Boarding Address.
 */
export const createLiftPsbt = async (req: LiftRequest): Promise<{ psbtBase64: string, boardingAddress: string }> => {
    try {
        const { ARK_API } = endpointsFor(req.network);
        if (!ARK_API) throw new Error('Ark lift is unavailable because no service endpoint is configured');

        // 1. Fetch ASP Info (Boarding Address & Server Pubkey)
        const response = await fetchWithRetry(`${ARK_API}/v1/info`, {}, 2, 500);
        if (!response.ok) {
            throw new Error(`Ark info request rejected by the service provider${response.status ? ` (HTTP ${response.status})` : ''}`);
        }
        const info: unknown = await response.json();
        const boardingAddressCandidate = isRecord(info)
            ? (isNonEmptyString(info.boardingAddress) ? info.boardingAddress : info.address)
            : undefined;
        if (!isNonEmptyString(boardingAddressCandidate)) {
            throw new Error('Ark info response did not include a boarding address');
        }
        const boardingAddress = boardingAddressCandidate;

        // 2. Fetch User UTXOs
        const utxos = await fetchUtxos(req.senderAddress, req.network);
        if (utxos.length === 0) throw new Error('No UTXOs available for lifting');

        // 3. Build PSBT
        const net = req.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
        const psbt = new bitcoin.Psbt({ network: net });
        let totalIn = 0;
        const feeRate = req.feeRate || 5; // sats/vbyte

        // Coin Selection (Simple)
        const selectedUtxos: UTXO[] = [];
        for (const utxo of utxos) {
            selectedUtxos.push(utxo);
            totalIn += utxo.amount;
            if (totalIn >= req.amountSats + 500) break; // Buffer for fees
        }

        if (totalIn < req.amountSats) throw new Error(`Insufficient funds: Have ${totalIn}, Need ${req.amountSats}`);

        // Add Inputs
        for (const utxo of selectedUtxos) {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.payments.p2wpkh({ address: req.senderAddress, network: net })!.output!,
                    value: BigInt(utxo.amount)
                }
            });
        }

        // Output 1: Boarding Address (The Lift)
        psbt.addOutput({ address: boardingAddress, value: BigInt(req.amountSats) });

        // Calculate Change
        const vbytes = estimateVbytes(selectedUtxos.length, 2);
        const fee = Math.ceil(vbytes * feeRate);
        const change = totalIn - req.amountSats - fee;

        if (change > 546) { // Dust limit
            psbt.addOutput({ address: req.senderAddress, value: BigInt(change) });
        }

        return {
            psbtBase64: psbt.toBase64(),
            boardingAddress
        };

    } catch (e: any) {
        notificationService.notify({
            type: 'error',
            title: 'Ark Lifting Failed',
            message: e.message || 'Unknown error',
            category: 'SYSTEM'
        });
        throw e;
    }
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
export const forfeitVtxo = async (vtxo: VTXO, recipientAddress: string, network: Network, vault?: string): Promise<string> => {
    if (!vtxo || !isNonEmptyString(vtxo.txid) || !isNonEmptyString(recipientAddress)) {
        throw new Error('Invalid VTXO or recipient');
    }

    try {
        const { ARK_API } = endpointsFor(network);
        if (!ARK_API) throw new Error('Ark forfeit is unavailable because no service endpoint is configured');
        if (!isNonEmptyString(vault)) throw new Error('Vault/seed required for Ark forfeit');

        const msgHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from(vtxo.txid + recipientAddress))).toString('hex');
        const signResult = await requestEnclaveSignature({
            type: 'psbt',
            layer: 'Ark',
            payload: {
                hash: msgHash,
                vtxoId: vtxo.txid,
                recipient: recipientAddress,
            },
            description: `Forfeit VTXO to ${recipientAddress}`,
        }, vault);

        const response = await fetchWithRetry(`${ARK_API}/v1/forfeit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vtxoId: vtxo.txid,
                recipient: recipientAddress,
                signature: signResult.signature,
            }),
        });
        const txid = await confirmedTxid(response, 'Ark forfeit');

        notificationService.notify({ category: 'TRANSACTION', type: 'success', title: 'Ark Transfer', message: `Forfeited VTXO ${vtxo.txid.slice(0, 8)}...` });
        return txid;
    } catch (error) {
        notificationService.notify({ category: 'TRANSACTION', type: 'error', title: 'Ark Transfer', message: `Forfeit failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
        throw error;
    }
};

/**
 * Redeems a VTXO (Unilateral Exit).
 * This creates a transaction that spends the VTXO and broadcasts it to Bitcoin L1.
 */
export const redeemVtxo = async (vtxo: VTXO, vault: string, network: Network): Promise<string> => {
    try {
        if (!vtxo || !isNonEmptyString(vtxo.txid)) throw new Error('Invalid VTXO');
        if (!isNonEmptyString(vault)) throw new Error('Vault/seed required for Ark redemption');

        const { ARK_API } = endpointsFor(network);
        if (!ARK_API) throw new Error('Ark redemption is unavailable because no service endpoint is configured');

        const msgHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from("redeem:" + vtxo.txid))).toString("hex");

        const signResult = await requestEnclaveSignature({
            type: 'message',
            layer: 'Ark',
            payload: { hash: msgHash },
            description: `Redeem VTXO ${vtxo.txid.slice(0,8)}`
        }, vault);

        const response = await fetchWithRetry(`${ARK_API}/v1/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vtxoId: vtxo.txid,
                signature: signResult.signature,
            }),
        });
        const txid = await confirmedTxid(response, 'Ark redemption');

        notificationService.notify({ category: 'SYSTEM', type: 'success', title: 'Ark Redemption', message: 'Unilateral exit confirmed by the Ark service provider' });
        return txid;
    } catch (error) {
        notificationService.notify({ category: 'SYSTEM', type: 'error', title: 'Ark Redemption', message: `Redemption failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
        throw error;
    }
};

/** Intentionally fail-closed legacy API; use createLiftPsbt for real requests. */
export const liftToArk = async (amount: number, address: string, aspId: string): Promise<never> => {
    void amount;
    void address;
    void aspId;
    throw new Error('Legacy Ark lift API is unsupported; use createLiftPsbt with a confirmed ASP response');
};
