import { Network } from '../types';
import { BoltzService } from './boltz';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SwapQuote {
  provider: 'Changelly' | 'THORChain' | 'Boltz';
  rate: number;
  minAmount: number;
  estimatedFee: number;
  id?: string;
  expiry?: number; // Boltz quotes expire
}

export interface SwapRequest {
  fromAsset: string;
  toAsset: string;
  amount: number;
  destinationAddress: string;
}

// ─── Feature Gate ────────────────────────────────────────────────────────────

/**
 * EXPERIMENTAL flag: Changelly integration is not yet connected to a real API.
 * Set to `false` to enable real API calls via the backend proxy.
 */
export const SWAP_EXPERIMENTAL = false;

const CHANGELLY_PROXY_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CHANGELLY_PROXY_URL) || '';

/**
 * Returns true if the Changelly backend proxy is configured and the feature is no longer experimental.
 */
export const isChangellyReady = (): boolean => {
  return !SWAP_EXPERIMENTAL && !!CHANGELLY_PROXY_URL;
};

// ─── THORChain (Production-Ready) ────────────────────────────────────────────

const TC_AFFILIATE_BPS = 50; // 0.5%
const TC_AFFILIATE_NAME = 'conxius';

/**
 * Generates a THORChain memo for a swap transaction.
 * Format: SWAP:CHAIN.ASSET:DEST_ADDR:AFFILIATE_NAME:AFFILIATE_FEE_BPS
 * Example: SWAP:ETH.ETH:0x123...:conxius:50
 */
export const buildThorchainMemo = (
  destChain: string, 
  destAsset: string, 
  destAddress: string, 
  limit?: number
): string => {
  const asset = `${destChain}.${destAsset}`;
  let memo = `SWAP:${asset}:${destAddress}:${TC_AFFILIATE_NAME}:${TC_AFFILIATE_BPS}`;
  
  if (limit) {
    memo += `:${limit}`;
  }
  
  return memo;
};

// ─── Boltz Submarine Swaps (Native / Lightning) ──────────────────────────────

/**
 * Fetches a swap quote from Boltz.
 */
export const fetchBoltzQuote = async (
    network: Network,
    pair: 'BTC/L-BTC' | 'BTC/BTC', // BTC/BTC is usually for Lightning
    amountSats: number
): Promise<SwapQuote | null> => {
    try {
        const pairs = await BoltzService.getPairs(network);
        const pairInfo = pairs[pair];
        if (!pairInfo) return null;

        // Boltz rate is usually 1:1 minus fees for these pairs
        const rate = 1; 
        // Fee calc: percentage + miner fee
        const percentageFee = (amountSats * pairInfo.fees.percentage) / 100;
        const minerFee = pairInfo.fees.minerFees.baseAsset.normal; // Approx
        const totalFee = percentageFee + minerFee;

        return {
            provider: 'Boltz',
            rate,
            minAmount: pairInfo.limits.minimal,
            estimatedFee: totalFee,
            id: `boltz_${Date.now()}`
        };
    } catch (e) {
        console.warn('Boltz quote failed', e);
        return null;
    }
};

/**
 * Creates a Boltz Swap (Submarine or Reverse).
 */
export const createBoltzSwap = async (
    network: Network,
    amountSats: number,
    toLayer: 'Liquid' | 'Lightning',
    destination: string
) => {
    // If destination is LN invoice, it's a Submarine Swap (BTC -> LN)
    // If destination is Address, it's also Submarine Swap (BTC -> Liquid/BTC)
    // If we are paying Invoice to get BTC, it's Reverse Swap.
    
    // For now, assuming Forward Swap: User sends BTC -> Receives on Liquid/LN
    return await BoltzService.createSubmarineSwap(amountSats, toLayer, destination, network);
};

// ─── Changelly API v2 (EXPERIMENTAL — JSON-RPC 2.0 via Backend Proxy) ───────
//
// Changelly API v2 uses JSON-RPC 2.0 over POST to https://api.changelly.com/v2
// Authentication requires RSA PKCS8 key pair:
//   - X-Api-Key: SHA256(publicKey) in base64
//   - X-Api-Signature: RSA-SHA256 signature of JSON body in base64
//
// Because RSA private keys MUST NOT be stored client-side, all Changelly calls
// are proxied through a backend service at VITE_CHANGELLY_PROXY_URL.
// The proxy handles signing and forwards the JSON-RPC request.
//
// Key methods:
//   - getPairsParams(from, to) → { minAmountFloat, maxAmountFloat }
//   - getExchangeAmount(from, to, amountFrom) → { amountTo, networkFee }
//   - createTransaction(from, to, address, amountFrom) → { payinAddress, id }
//   - getStatus(id) → { status }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls the Changelly backend proxy with a JSON-RPC 2.0 method.
 * Throws if SWAP_EXPERIMENTAL is true or proxy URL is not configured.
 */
const changellyRpc = async (method: string, params: Record<string, unknown> | Record<string, unknown>[]): Promise<unknown> => {
  if (SWAP_EXPERIMENTAL) {
    throw new Error('[Changelly] EXPERIMENTAL: Swap service is not connected to a real API. Configure VITE_CHANGELLY_PROXY_URL and disable SWAP_EXPERIMENTAL flag.');
  }
  if (!CHANGELLY_PROXY_URL) {
    throw new Error('[Changelly] Backend proxy URL not configured. Set VITE_CHANGELLY_PROXY_URL.');
  }

  const body = {
    jsonrpc: '2.0',
    id: `conxius_${Date.now()}`,
    method,
    params,
  };

  const response = await fetch(CHANGELLY_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`[Changelly] Proxy error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(`[Changelly] API error ${json.error.code}: ${json.error.message}`);
  }

  return json.result;
};

/**
 * Fetches a swap quote from Changelly.
 * When SWAP_EXPERIMENTAL is true, returns a clearly-labelled mock quote
 * with zero-value fields to prevent misuse.
 */
export const fetchChangellyQuote = async (
  from: string,
  to: string,
  amount: number
): Promise<SwapQuote> => {
  if (SWAP_EXPERIMENTAL) {
    console.warn('[Swap] EXPERIMENTAL: Changelly integration is mocked. Do not use for real transactions.');
    return {
      provider: 'Changelly',
      rate: 0,
      minAmount: 0,
      estimatedFee: 0,
      id: `mock_${Date.now()}`
    };
  }

  const result = await changellyRpc('getExchangeAmount', [{ from, to, amountFrom: amount }]) as any[];
  const quote = result[0];
  return {
    provider: 'Changelly',
    rate: parseFloat(quote.amountTo) / amount,
    minAmount: parseFloat(quote.minAmountFloat || '0'),
    estimatedFee: parseFloat(quote.networkFee || '0'),
    id: quote.id,
  };
};

/**
 * Creates a Changelly transaction. HARD-BLOCKED when experimental.
 * This function will THROW and never return a fake payinAddress.
 */
export const createChangellyTransaction = async (
  from: string,
  to: string,
  amount: number,
  address: string
): Promise<{ payinAddress: string; id: string }> => {
  // HARD BLOCK: Never return a fake address that could cause fund loss
  if (SWAP_EXPERIMENTAL || !CHANGELLY_PROXY_URL) {
    throw new Error(
      '[Changelly] Transaction creation is DISABLED. ' +
      'Changelly API v2 backend proxy is not configured. ' +
      'Sending funds to a mock address would result in permanent loss.'
    );
  }

  const result = await changellyRpc('createTransaction', {
    from,
    to,
    address,
    amountFrom: amount.toString(),
  }) as { payinAddress: string; id: string };

  if (!result.payinAddress || !result.payinAddress.startsWith('bc1') && !result.payinAddress.startsWith('0x') && !result.payinAddress.startsWith('1') && !result.payinAddress.startsWith('3')) {
    throw new Error('[Changelly] Received invalid payinAddress from API. Aborting to prevent fund loss.');
  }

  return {
    payinAddress: result.payinAddress,
    id: result.id,
  };
};

// ─── Gas Abstraction (EXPERIMENTAL) ──────────────────────────────────────────

/**
 * EXPERIMENTAL: Gas swap stub. Real implementation requires DEX aggregator integration.
 */
export const executeGasSwap = async (
  sourceAsset: string,
  amount: number,
  destinationAsset: string
): Promise<boolean> => {
  console.warn('[GasSwap] EXPERIMENTAL: Gas abstraction is mocked.');
  await new Promise(resolve => setTimeout(resolve, 1500));
  return true;
};
