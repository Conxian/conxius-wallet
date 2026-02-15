import { Asset, Network } from '../types';
import { endpointsFor, fetchWithRetry } from './network';
import { fetchBtcPrice } from './prices';

export interface MavenAsset {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    balance: number;
    valueUsd?: number;
}

/**
 * Maven Protocol Service
 * Handles interactions with the Maven Layer (sidechain/L2).
 */

/**
 * Fetches assets from the Maven Protocol Indexer.
 */
export const fetchMavenAssets = async (address: string, network: Network = 'mainnet'): Promise<Asset[]> => {
    const { MAVEN_API } = endpointsFor(network);
    try {
        const response = await fetchWithRetry(`${MAVEN_API as string}/v1/account/${address}/assets`, {}, 2, 750);
        
        if (!response.ok) {
            // If 404, maybe account not found, return empty
            return [];
        }

        const data = await response.json();
        const btcPrice = await fetchBtcPrice();
        
        // Map Maven specific response to generic Asset
        // Assuming response structure: { assets: [ { assetId, symbol, amount, decimals } ] }
        const items = Array.isArray(data) ? data : (data.assets || []);

        return items.map((item: any, index: number) => {
            const decimals = item.decimals || 8;
            const balance = (parseInt(item.amount || '0')) / Math.pow(10, decimals);
            const symbol = item.symbol || 'MAV';
            
            return {
                id: item.assetId || `maven-${index}`,
                name: item.name || `Maven ${symbol}`,
                symbol: symbol,
                balance: balance,
                valueUsd: (item.valueUsd) ? parseFloat(item.valueUsd) : 0,
                layer: 'Maven',
                type: symbol === 'BTC' ? 'Wrapped' : 'Native', // Or Token
                address
            };
        });

    } catch (e) {
        console.warn('[Maven] Fetch failed', e);
        return [];
    }
};

/**
 * Broadcasts a raw transaction to the Maven network.
 */
export const broadcastMavenTx = async (txHex: string, network: Network = 'mainnet'): Promise<string> => {
    const { MAVEN_API } = endpointsFor(network);
    try {
        const response = await fetchWithRetry(`${MAVEN_API as string}/v1/tx/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hex: txHex })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Maven broadcast failed: ${err}`);
        }

        const data = await response.json();
        return data.txid;
    } catch (e: any) {
        throw new Error(e.message || 'Maven network error');
    }
};
