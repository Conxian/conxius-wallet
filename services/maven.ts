import { requestEnclaveSignature } from './signer';
import { notificationService } from './notifications';
import { endpointsFor, fetchWithRetry } from './network';
import { Network, Asset } from '../types';
import * as bitcoin from 'bitcoinjs-lib';

export interface MavenAsset extends Asset {
    mavenId: string;
}

/**
 * Maven Protocol Service (M6 Implementation)
 * Integrated L2 for asset issuance and fast transfers.
 */

/**
 * Fetches all assets for a given address on the Maven protocol.
 */
export const fetchMavenAssets = async (address: string, network: Network = 'mainnet'): Promise<Asset[]> => {
    try {
        const { MAVEN_API } = endpointsFor(network);
        if (!MAVEN_API) return [];

        const response = await fetchWithRetry(`${MAVEN_API}/v1/address/${address}/assets`, {}, 1, 1000);
        if (!response.ok) return [];

        const data = await response.json();
        return (data.assets || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            symbol: a.symbol,
            balance: a.balance,
            valueUsd: a.valueUsd || 0,
            layer: 'Maven',
            type: 'Native',
            address
        }));
    } catch (e) {
        console.warn('[Maven] Fetch failed', e);
        return [];
    }
};

/**
 * Prepares and signs a Maven asset transfer.
 */
export const createMavenTransfer = async (
    assetId: string,
    amount: number,
    recipient: string,
    vault: string,
    network: Network = 'mainnet'
): Promise<string> => {
    notificationService.notify({ category: 'TRANSACTION', type: 'info', title: 'Maven Transfer', message: `Preparing transfer for ${amount} units...` });

    try {
        // 1. Construct Maven-specific transfer payload
        const payload = {
            assetId,
            amount,
            recipient,
            timestamp: Date.now()
        };

        const msgHash = Buffer.from(bitcoin.crypto.sha256(Buffer.from(JSON.stringify(payload)))).toString("hex");

        // 2. Request Enclave Signature
        const signResult = await requestEnclaveSignature({
            type: 'transaction',
            layer: 'Maven',
            payload: { hash: msgHash, ...payload },
            description: `Maven Transfer: ${amount} units`
        }, vault);

        // 3. Broadcast to Maven Indexer/Sequencer
        const { MAVEN_API } = endpointsFor(network);
        if (MAVEN_API) {
            const response = await fetchWithRetry(`${MAVEN_API}/v1/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...payload,
                    signature: signResult.signature,
                    pubkey: signResult.pubkey
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Maven Node rejected transfer');
            }

            const data = await response.json();
            notificationService.notify({ category: 'TRANSACTION', type: 'success', title: 'Maven Transfer', message: 'Transfer successful' });
            return data.txid;
        }

        return "maven_sim_txid_" + Date.now();

    } catch (e: any) {
        notificationService.notify({ category: 'TRANSACTION', type: 'error', title: 'Maven Transfer', message: `Transfer failed: ${e.message}` });
        throw e;
    }
};
