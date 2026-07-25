import { Network, BitcoinLayer, Asset, UTXO } from '../types';
import { fetchWithRetry, endpointsFor } from './network';
import { digestCanonicalPayload } from './value-operation-gate';

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

export type ProtocolVerificationOutcome =
    | Readonly<{ kind: 'unsupported'; reason: 'qualified_verifier_unavailable'; subjectDigest: string }>
    | Readonly<{ kind: 'rejected'; reason: 'invalid_verification_subject' }>;

export const monitorSbtcPegIn = async (txid: string, network: Network = 'mainnet'): Promise<ProtocolVerificationOutcome> => {
    const normalized = txid.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_verification_subject' });
    }
    return Object.freeze({
        kind: 'unsupported', reason: 'qualified_verifier_unavailable',
        subjectDigest: digestCanonicalPayload(Object.freeze({ kind: 'conxius.wallet.sbtc-peg-in-status.v1', txid: normalized, network })),
    });
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

export type NativePegAddressOutcome =
    | Readonly<{ kind: 'available'; address: string; source: 'qualified-provider' }>
    | Readonly<{
        kind: 'unsupported';
        reason: 'qualified_peg_address_provider_unavailable';
        layer: BitcoinLayer;
        network: Network;
    }>;

export const fetchNativePegAddress = async (
    layer: BitcoinLayer,
    network: Network = 'mainnet',
): Promise<NativePegAddressOutcome> => Object.freeze({
    kind: 'unsupported', reason: 'qualified_peg_address_provider_unavailable', layer, network,
});

export const getUnifiedBitcoinBalance = (assets: Asset[]): number => {
    return assets
        .filter(a => a.layer === 'Mainnet' || a.layer === 'Lightning')
        .reduce((acc, a) => acc + a.balance, 0);
};

export class LightClient {
    public async syncHeaders(network: Network): Promise<Readonly<{
        kind: 'unsupported'; reason: 'qualified_header_source_unavailable'; network: Network;
    }>> {
        return Object.freeze({ kind: 'unsupported', reason: 'qualified_header_source_unavailable', network });
    }
    public async verifyTransaction(txid: string, merkleProof: string): Promise<ProtocolVerificationOutcome> {
        const normalizedTxid = txid.trim().toLowerCase();
        const normalizedProof = merkleProof.trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(normalizedTxid) || !/^[0-9a-f]+$/.test(normalizedProof)) {
            return Object.freeze({ kind: 'rejected', reason: 'invalid_verification_subject' });
        }
        return Object.freeze({
            kind: 'unsupported', reason: 'qualified_verifier_unavailable',
            subjectDigest: digestCanonicalPayload(Object.freeze({
                kind: 'conxius.wallet.bitcoin-merkle-verification.v1', txid: normalizedTxid,
                merkleProofDigest: digestCanonicalPayload(Object.freeze({ kind: 'bitcoin-merkle-proof', value: normalizedProof })),
            })),
        });
    }
}
