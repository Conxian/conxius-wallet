import { AppState, Network } from '../types';
import { fetchWithRetry } from './network';
import { calculateEffectiveFeeRate } from './monetization';

export interface YieldOpportunity {
    id: string;
    protocol: string;
    asset: string;
    network: string;
    apy: number;
    tvl: number;
    riskScore: number;
    metadata?: any;
}

export interface YieldAction {
    readonly transactionData: Readonly<Record<string, unknown>>;
    readonly feeAmount: number;
    readonly status: 'unsigned-provider-payload';
}

export type YieldActionResult =
    | Readonly<{ kind: 'prepared'; action: YieldAction }>
    | Readonly<{ kind: 'indeterminate'; reason: 'provider_request_ambiguous' }>
    | Readonly<{ kind: 'rejected'; reason: 'invalid_request' | 'provider_rejected' | 'malformed_provider_response' }>;

const YIELD_API_BASE = 'https://api.yield.xyz/v1';

export async function fetchYields(limit: number = 20): Promise<YieldOpportunity[]> {
    try {
        const response = await fetchWithRetry(`${YIELD_API_BASE}/yields?limit=${limit}`, {
            method: 'GET',
            headers: { 'accept': 'application/json' }
        });
        if (!response.ok) throw new Error('API down');
        const data = await response.json();
        return data.yields.map((y: any) => ({
            id: y.yieldId || y.id,
            protocol: y.yieldProtocol || y.protocol,
            asset: y.asset,
            network: y.network,
            apy: y.apy || 0,
            tvl: y.tvl || 0,
            riskScore: y.riskScore || 0
        }));
    } catch {
        return [
            { id: 'y1', protocol: 'Lido', asset: 'ETH', network: 'Ethereum', apy: 3.8, tvl: 32000000000, riskScore: 9.5 }
        ];
    }
}

export async function createYieldTransaction(
    yieldId: string,
    amount: string,
    state: AppState,
    _network: Network = 'mainnet'
): Promise<YieldActionResult> {
    void _network;
    if (!yieldId.trim() || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(amount) || Number(amount) <= 0) {
        return Object.freeze({ kind: 'rejected', reason: 'invalid_request' });
    }
    const rate = calculateEffectiveFeeRate(state);
    const feeAmount = parseFloat(amount) * rate;
    try {
        const response = await fetchWithRetry(`${YIELD_API_BASE}/actions/enter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yieldId, amount, affiliate: 'conxius', feeRate: rate })
        }, 0);
        if (!response.ok) return Object.freeze({ kind: 'rejected', reason: 'provider_rejected' });
        const data: unknown = await response.json();
        const transaction = typeof data === 'object' && data !== null && !Array.isArray(data)
            ? (data as { transaction?: unknown }).transaction : null;
        if (typeof transaction !== 'object' || transaction === null || Array.isArray(transaction)) {
            return Object.freeze({ kind: 'rejected', reason: 'malformed_provider_response' });
        }
        const record = transaction as Record<string, unknown>;
        if (typeof record.to !== 'string' || !record.to.trim() || typeof record.data !== 'string' || !record.data.startsWith('0x')) {
            return Object.freeze({ kind: 'rejected', reason: 'malformed_provider_response' });
        }
        return Object.freeze({
            kind: 'prepared',
            action: Object.freeze({ transactionData: Object.freeze({ ...record }), feeAmount, status: 'unsigned-provider-payload' }),
        });
    } catch {
        return Object.freeze({ kind: 'indeterminate', reason: 'provider_request_ambiguous' });
    }
}
