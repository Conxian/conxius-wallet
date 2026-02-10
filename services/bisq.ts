
import { Network } from '../types';

// ─── Feature Gate ────────────────────────────────────────────────────────────

/**
 * EXPERIMENTAL: Bisq DEX integration requires a running Bisq daemon with gRPC API enabled.
 *
 * Architecture:
 *   Mobile App → HTTPS → Backend Proxy → gRPC → Bisq Daemon (user-hosted or trusted node)
 *
 * Bisq gRPC API Reference: https://bisq-network.github.io/slate/
 * Proto files: https://github.com/bisq-network/bisq/tree/master/proto/src/main/proto
 *
 * Services available via gRPC:
 *   - Offers: create, edit, list, cancel, take offers
 *   - Trades: execute, confirm payment, withdraw funds
 *   - Wallets: balances, send BTC/BSQ, funding addresses
 *   - PaymentAccounts: create and list payment accounts
 *   - Price: market price, average BSQ trade price
 *
 * The proxy URL should point to a backend that translates REST/JSON to gRPC calls.
 * Users can self-host this proxy alongside their Bisq daemon for full sovereignty.
 */
export const BISQ_EXPERIMENTAL = true;

/**
 * Backend proxy URL for Bisq gRPC bridge.
 * Set via VITE_BISQ_PROXY_URL environment variable.
 * The proxy must implement REST endpoints that map to Bisq gRPC services.
 */
const BISQ_PROXY_URL = import.meta.env.VITE_BISQ_PROXY_URL || '';

export const isBisqReady = (): boolean => {
  return !BISQ_EXPERIMENTAL && BISQ_PROXY_URL.length > 0;
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

/**
 * Makes a request to the Bisq gRPC proxy backend.
 * The proxy translates REST calls to gRPC calls against the user's Bisq daemon.
 *
 * @param endpoint - REST endpoint path (e.g., '/offers', '/trades', '/wallets/balances')
 * @param method - HTTP method
 * @param body - Request body (for POST/PUT)
 */
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

  if (BISQ_EXPERIMENTAL) {
    throw new Error(
      '[Bisq] DEX integration is EXPERIMENTAL. ' +
      'Requires a running Bisq daemon with gRPC API enabled and a proxy backend. ' +
      'Do NOT use with real funds until fully verified.'
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

/**
 * Fetches available offers from the Bisq network.
 * Maps to gRPC: Offers.GetOffers
 */
export const fetchBisqOffers = async (
  direction: 'BUY' | 'SELL',
  currencyCode: string = 'USD'
): Promise<BisqOffer[]> => {
  if (BISQ_EXPERIMENTAL) {
    console.warn('[Bisq] fetchBisqOffers is EXPERIMENTAL — returning empty list.');
    return [];
  }
  return bisqProxy<BisqOffer[]>(`/offers?direction=${direction}&currencyCode=${currencyCode}`);
};

/**
 * Creates a new offer on the Bisq network.
 * Maps to gRPC: Offers.CreateOffer
 *
 * BLOCKED in experimental mode to prevent fund loss.
 */
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
  if (BISQ_EXPERIMENTAL) {
    throw new Error(
      '[Bisq] createBisqOffer is EXPERIMENTAL and BLOCKED. ' +
      'Cannot create real offers until Bisq daemon integration is verified.'
    );
  }
  return bisqProxy<BisqOffer>('/offers', 'POST', params as unknown as Record<string, unknown>);
};

/**
 * Takes an existing offer from the Bisq network.
 * Maps to gRPC: Trades.TakeOffer
 *
 * BLOCKED in experimental mode to prevent fund loss.
 */
export const takeBisqOffer = async (
  offerId: string,
  paymentAccountId: string,
  takerFeeCurrencyCode: string = 'btc'
): Promise<BisqTrade> => {
  if (BISQ_EXPERIMENTAL) {
    throw new Error(
      '[Bisq] takeBisqOffer is EXPERIMENTAL and BLOCKED. ' +
      'Cannot take real offers until Bisq daemon integration is verified.'
    );
  }
  return bisqProxy<BisqTrade>('/trades/take', 'POST', {
    offerId,
    paymentAccountId,
    takerFeeCurrencyCode,
  });
};

// ─── Trades API ──────────────────────────────────────────────────────────────

/**
 * Fetches trade details.
 * Maps to gRPC: Trades.GetTrade
 */
export const fetchBisqTrade = async (tradeId: string): Promise<BisqTrade | null> => {
  if (BISQ_EXPERIMENTAL) {
    console.warn('[Bisq] fetchBisqTrade is EXPERIMENTAL — returning null.');
    return null;
  }
  return bisqProxy<BisqTrade>(`/trades/${tradeId}`);
};

/**
 * Confirms payment has been started (for buyer).
 * Maps to gRPC: Trades.ConfirmPaymentStarted
 */
export const confirmPaymentStarted = async (tradeId: string): Promise<void> => {
  if (BISQ_EXPERIMENTAL) {
    throw new Error('[Bisq] confirmPaymentStarted is EXPERIMENTAL and BLOCKED.');
  }
  await bisqProxy('/trades/confirm-payment-started', 'POST', { tradeId });
};

/**
 * Confirms payment has been received (for seller).
 * Maps to gRPC: Trades.ConfirmPaymentReceived
 */
export const confirmPaymentReceived = async (tradeId: string): Promise<void> => {
  if (BISQ_EXPERIMENTAL) {
    throw new Error('[Bisq] confirmPaymentReceived is EXPERIMENTAL and BLOCKED.');
  }
  await bisqProxy('/trades/confirm-payment-received', 'POST', { tradeId });
};

// ─── Wallets API ─────────────────────────────────────────────────────────────

/**
 * Fetches BTC and BSQ balances from the Bisq daemon wallet.
 * Maps to gRPC: Wallets.GetBalances
 */
export const fetchBisqBalances = async (): Promise<{ btc: BisqBalance; bsq: BisqBalance } | null> => {
  if (BISQ_EXPERIMENTAL) {
    console.warn('[Bisq] fetchBisqBalances is EXPERIMENTAL — returning null.');
    return null;
  }
  return bisqProxy('/wallets/balances');
};

/**
 * Fetches current market price for a currency pair.
 * Maps to gRPC: Price.GetMarketPrice
 */
export const fetchBisqMarketPrice = async (currencyCode: string = 'USD'): Promise<BisqMarketPrice | null> => {
  if (BISQ_EXPERIMENTAL) {
    console.warn('[Bisq] fetchBisqMarketPrice is EXPERIMENTAL — returning null.');
    return null;
  }
  return bisqProxy(`/price?currencyCode=${currencyCode}`);
};

// ─── Integration Notes ──────────────────────────────────────────────────────
//
// To enable Bisq DEX in Conxius Wallet:
//
// 1. BACKEND PROXY SETUP:
//    Deploy a REST→gRPC proxy that connects to a Bisq daemon.
//    The proxy must run on HTTPS and authenticate requests.
//    Recommended: Node.js + @grpc/grpc-js with Bisq proto files.
//    Proto files: https://github.com/bisq-network/bisq/tree/master/proto/src/main/proto
//
// 2. ENVIRONMENT VARIABLE:
//    Set VITE_BISQ_PROXY_URL=https://your-bisq-proxy.example.com/api
//    This should be the user's own proxy or a trusted community node.
//
// 3. BISQ DAEMON:
//    Run Bisq in daemon mode: ./bisq-daemon --apiPassword=<password> --apiPort=9998
//    The daemon manages its own Bitcoin wallet and Tor connections.
//    WARNING: Never run Bisq daemon and Bisq desktop app simultaneously.
//
// 4. SECURITY CONSIDERATIONS:
//    - All trade operations use Bisq's 2-of-2 multisig escrow
//    - The proxy must be authenticated (API key or mTLS)
//    - Bisq daemon wallet is separate from Conxius wallet
//    - Users should back up their Bisq wallet independently
//
// 5. BISQ 2 MIGRATION:
//    Bisq 2 (bisq-network/bisq2) introduces "Bisq Easy" with reputation-based trading.
//    Future versions should support both Bisq v1 gRPC and Bisq 2 protocols.
//    Bisq 2 may eventually offer a lighter integration path for mobile.
