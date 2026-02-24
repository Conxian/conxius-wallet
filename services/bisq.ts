import { Network } from '../types';

// ─── Feature Gate ────────────────────────────────────────────────────────────

/**
 * Bisq DEX integration.
 * Requires a running Bisq daemon with gRPC API enabled and a proxy backend.
 */
export const BISQ_EXPERIMENTAL = false;

/**
 * Backend proxy URL for Bisq gRPC bridge.
 * Set via VITE_BISQ_PROXY_URL environment variable.
 */
const BISQ_PROXY_URL = import.meta.env.VITE_BISQ_PROXY_URL || '';

export const isBisqReady = (): boolean => {
  return BISQ_PROXY_URL.length > 0;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BisqOffer {
  id: string;
  direction: 'BUY' | 'SELL';
  price: string;
  amount: string;
  minAmount: string;
  volume: string;
  currencyCode: string;
  paymentMethodId: string;
  date: number;
  ownerNodeAddress: string;
  isMyOffer: boolean;
}

export interface BisqTrade {
  tradeId: string;
  offerId: string;
  date: number;
  role: string;
  isCurrencyForTakerFeeBtc: boolean;
  txFeeAsLong: number;
  takerFeeAsLong: number;
  tradeAmountAsLong: number;
  tradePrice: string;
  tradingPeerNodeAddress: string;
  state: string;
  phase: string;
  isDepositPublished: boolean;
  isDepositConfirmed: boolean;
  isFiatSent: boolean;
  isFiatReceived: boolean;
  isPayoutPublished: boolean;
  isWithdrawn: boolean;
  contractAsJson: string;
}

export interface BisqBalance {
  availableBalance: number;
  reservedBalance: number;
  lockedBalance: number;
  totalAvailableBalance: number;
}

export interface BisqMarketPrice {
  currencyCode: string;
  price: number;
}

// ─── Proxy Client ────────────────────────────────────────────────────────────

const bisqProxy = async <T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>
): Promise<T> => {
  if (!BISQ_PROXY_URL) {
    throw new Error(
      '[Bisq] Proxy URL not configured. Set VITE_BISQ_PROXY_URL to your Bisq gRPC proxy backend.'
    );
  }

  const response = await fetch(`${BISQ_PROXY_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`[Bisq] Proxy error ${response.status}: ${error}`);
  }

  return response.json();
};

// ─── Offers API ──────────────────────────────────────────────────────────────

export const fetchBisqOffers = async (
  direction: 'BUY' | 'SELL',
  currencyCode: string = 'USD'
): Promise<BisqOffer[]> => {
  return bisqProxy<BisqOffer[]>(`/offers?direction=${direction}&currencyCode=${currencyCode}`);
};

export const createBisqOffer = async (params: {
  direction: 'BUY' | 'SELL';
  currencyCode: string;
  amount: string;
  minAmount: string;
  price: string;
  useMarketBasedPrice: boolean;
  marketPriceMargin: number;
  buyerSecurityDeposit: number;
  paymentAccountId: string;
}): Promise<BisqOffer> => {
  return bisqProxy<BisqOffer>('/offers', 'POST', params as unknown as Record<string, unknown>);
};

export const takeBisqOffer = async (
  offerId: string,
  paymentAccountId: string,
  takerFeeCurrencyCode: string = 'btc'
): Promise<BisqTrade> => {
  return bisqProxy<BisqTrade>('/trades/take', 'POST', {
    offerId,
    paymentAccountId,
    takerFeeCurrencyCode,
  });
};

// ─── Trades API ──────────────────────────────────────────────────────────────

export const fetchBisqTrade = async (tradeId: string): Promise<BisqTrade | null> => {
  return bisqProxy<BisqTrade>(`/trades/${tradeId}`);
};

export const confirmPaymentStarted = async (tradeId: string): Promise<void> => {
  await bisqProxy('/trades/confirm-payment-started', 'POST', { tradeId });
};

export const confirmPaymentReceived = async (tradeId: string): Promise<void> => {
  await bisqProxy('/trades/confirm-payment-received', 'POST', { tradeId });
};

// ─── Wallets API ─────────────────────────────────────────────────────────────

export const fetchBisqBalances = async (): Promise<{ btc: BisqBalance; bsq: BisqBalance } | null> => {
  return bisqProxy('/wallets/balances');
};

export const fetchBisqMarketPrice = async (currencyCode: string = 'USD'): Promise<BisqMarketPrice | null> => {
  return bisqProxy(`/price?currencyCode=${currencyCode}`);
};
