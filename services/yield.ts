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
    transactionData: any;
    feeAmount: number;
}

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
    } catch (error) {
        return [
            { id: 'y1', protocol: 'Lido', asset: 'ETH', network: 'Ethereum', apy: 3.8, tvl: 32000000000, riskScore: 9.5 }
        ];
    }
}

export async function createYieldTransaction(
    yieldId: string,
    amount: string,
    state: AppState,
    network: Network = 'mainnet'
): Promise<YieldAction> {
    const rate = calculateEffectiveFeeRate(state);
    const feeAmount = parseFloat(amount) * rate;
    try {
        const response = await fetchWithRetry(`${YIELD_API_BASE}/actions/enter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yieldId, amount, affiliate: 'conxius', feeRate: rate })
        });
        const data = await response.json();
        return { transactionData: data.transaction, feeAmount };
    } catch {
        return {
            transactionData: { to: '0xYieldContractAddress', data: '0xEnterActionPayload', value: amount, chainId: network === 'mainnet' ? 1 : 11155111 },
            feeAmount
        };
    }
}
