import { Network, BitcoinLayer, Asset, UTXO } from '../types';
import { fetchWithRetry, endpointsFor } from './network';
import { generateRandomString } from './random';
import * as bitcoin from 'bitcoinjs-lib';

// Re-export for backward compatibility
export { endpointsFor, fetchWithRetry };

const toFiniteNumber = (val: any, fallback: number = 0): number => {
    const n = parseFloat(val);
    return isFinite(n) ? n : fallback;
};

export const fetchBtcPrice = async (): Promise<number> => 100000;
export const fetchStxPrice = async (): Promise<number> => 2.5;

export const fetchBtcBalance = async (address: string, network: Network = 'mainnet'): Promise<number> => {
    try {
        const { BTC_API } = endpointsFor(network) as any;
        const response = await fetchWithRetry(`${BTC_API}/address/${address}`);
        if (!response.ok) return 0;
        const data = await response.json();
        return (data.chain_stats?.funded_txo_sum || 0) - (data.chain_stats?.spent_txo_sum || 0);
    } catch { return 0; }
};

export const fetchUtxos = async (address: string, network: Network = 'mainnet'): Promise<UTXO[]> => {
    try {
        const { BTC_API } = endpointsFor(network) as any;
        const response = await fetchWithRetry(`${BTC_API}/address/${address}/utxo`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((u: any) => ({
            txid: u.txid,
            vout: u.vout,
            amount: u.value,
            address,
            status: u.status.confirmed ? 'confirmed' : 'pending',
            isFrozen: false,
            derivationPath: "m/84'/0'/0'/0/0",
            privacyRisk: 'Low'
        }));
    } catch { return []; }
};

export { fetchUtxos as fetchBtcUtxos };

export const broadcastTransaction = async (hex: string, layer: BitcoinLayer, network: Network = 'mainnet'): Promise<string> => {
    const endpoints = endpointsFor(network) as any;
    let url = '';
    if (layer === 'Mainnet') url = `${endpoints.BTC_API}/tx`;
    else if (layer === 'Stacks') url = `${endpoints.STX_API}/v2/transactions`;
    else throw new Error(`Broadcast not implemented for layer: ${layer}`);

    const response = await fetchWithRetry(url, {
        method: 'POST',
        body: hex,
        headers: { 'Content-Type': 'text/plain' }
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err || `Broadcast failed with status ${response.status}`);
    }

    return layer === 'Stacks' ? (await response.json()).txid : await response.text();
};

export const getTransactionStatus = async (txid: string, layer: BitcoinLayer, network: Network = 'mainnet'): Promise<{ status: string }> => {
    const endpoints = endpointsFor(network) as any;
    try {
        let url = '';
        if (layer === 'Mainnet') url = `${endpoints.BTC_API}/tx/${txid}`;
        else if (layer === 'Stacks') url = `${endpoints.STX_API}/extended/v1/tx/${txid}`;
        else return { status: 'unknown' };

        const res = await fetchWithRetry(url);
        const data = await res.json();

        if (layer === 'Mainnet') return { status: data.status?.confirmed ? 'completed' : 'pending' };
        if (layer === 'Stacks') return { status: data.tx_status === 'success' ? 'completed' : 'pending' };

        return { status: 'pending' };
    } catch {
        return { status: 'pending' };
    }
};

export const fetchGlobalReserveMetrics = async (network: Network = 'mainnet') => {
    const { STX_API } = endpointsFor(network) as any;
    try {
        const res = await fetchWithRetry(`${STX_API}/extended/v1/sbtc/supply`);
        const data = await res.json();
        return {
            totalSbtc: toFiniteNumber(data.totalSbtc || data.total_supply),
            totalBtcLocked: toFiniteNumber(data.totalBtcLocked || data.btc_locked),
            ratio: toFiniteNumber(data.ratio, 1.0)
        };
    } catch {
        return { totalSbtc: 0, totalBtcLocked: 0, ratio: 1.0 };
    }
};

export const fetchSbtcWalletAddress = async (network: Network = 'mainnet'): Promise<string> => {
    return network === 'mainnet' ? 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sbtc-token' : 'ST3FBR...';
};

export const monitorSbtcPegIn = async (txid: string, network: Network = 'mainnet'): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 2000));
    return true;
};

// Simplified EVM Balance fetcher
async function fetchEvmBalance(rpc: string, address: string): Promise<number> {
    try {
        const res = await fetchWithRetry(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] })
        });
        const data = await res.json();
        return parseInt(data.result, 16) / 1e18;
    } catch { return 0; }
}

export async function fetchBobAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> {
    const { BOB_API } = endpointsFor(network) as any;
    const balance = await fetchEvmBalance(BOB_API, address);
    if (balance === 0) return [];
    return [{ id: 'bob-btc', name: 'BOB BTC', symbol: 'BOB-BTC', balance, valueUsd: balance * 100000, layer: 'BOB', type: 'Native', address }];
}

export async function fetchB2Assets(address: string, network: Network = 'mainnet'): Promise<Asset[]> {
    const { B2_API } = endpointsFor(network) as any;
    const balance = await fetchEvmBalance(B2_API, address);
    if (balance === 0) return [];
    return [{ id: 'b2-btc', name: 'B2 Network BTC', symbol: 'B2-BTC', balance, valueUsd: balance * 100000, layer: 'B2', type: 'Native', address }];
}

export async function fetchBotanixAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchMezoAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchAlpenAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchZuluAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchBisonAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchHemiAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchNubitAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchLorenzoAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchCitreaAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchBabylonAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchMerlinAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchBitlayerAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchTaprootAssets(address: string, network: Network = 'mainnet'): Promise<Asset[]> { return []; }
export async function fetchRunesBalances(address: string): Promise<Asset[]> { return []; }
export async function fetchRgbAssets(address: string): Promise<Asset[]> { return []; }
export async function fetchArkBalances(address: string): Promise<Asset[]> { return []; }

export const fetchNativePegAddress = async (layer: BitcoinLayer, network: Network = 'mainnet'): Promise<string> => {
    if (layer === 'Stacks') return fetchSbtcWalletAddress(network);
    return 'bc1q_production_gateway';
};

export const getUnifiedBitcoinBalance = (assets: Asset[]): number => {
    return assets
        .filter(a => a.layer === 'Mainnet' || a.layer === 'Lightning')
        .reduce((acc, a) => acc + a.balance, 0);
};

export class LightClient {
    public async syncHeaders(network: Network): Promise<number> { return 840000; }
    public async verifyTransaction(txid: string, merkleProof: string): Promise<boolean> { return true; }
}
