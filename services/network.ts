import { Network, AppState } from '../types';
import { generateRandomString } from './random';

let _globalAppState: AppState | undefined;

export const setGlobalAppState = (state: AppState) => {
  _globalAppState = state;
};

function envValue(key: string): string | undefined {
  const value = (import.meta as any).env?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * The Conxian Gateway acts as a unified entry point for sovereign services.
 * Defaults to localhost in development/regtest and conxianlabs.com in production.
 */
export function getGatewayUrl(network: Network): string {
  const envGateway = envValue('VITE_GATEWAY_URL');
  if (envGateway) return envGateway;

  switch (network) {
    case 'regtest':
      return "http://127.0.0.1:8080";
    case 'testnet':
      return "https://gateway.testnet.conxianlabs.com";
    default:
      return "https://gateway.conxianlabs.com";
  }
}

/**
 * Sovereign-First Endpoint Resolver (v1.1)
 * Prioritizes user nodes, then public RPCs, based on rpcStrategy.
 */
export function endpointsFor(network: Network, appState?: AppState) {
  const gateway = getGatewayUrl(network);
  const state = appState || _globalAppState;
  const strategy = state?.rpcStrategy || 'Sovereign-First';
  const customNodes = state?.customNodes || [];

  const getSovereignEndpoint = (layer: string, defaultPublic: string): string => {
      if (strategy === 'Public-Only') return defaultPublic;

      const custom = customNodes.find(n => n.layer === layer && n.isActive);

      if (strategy === 'Sovereign-First') return custom?.endpoint || defaultPublic;
      if (strategy === 'Mixed') return custom?.endpoint || defaultPublic; // Could be expanded for load balancing

      return defaultPublic;
  };

  switch (network) {
    case 'testnet':
      return {
        BTC_API: getSovereignEndpoint('Bitcoin L1', "https://mempool.space/testnet/api"),
        STX_API: getSovereignEndpoint('Stacks L2', "https://api.testnet.hiro.so"),
        LIQUID_API: getSovereignEndpoint('Liquid', "https://blockstream.info/liquidtestnet/api"),
        RSK_API: getSovereignEndpoint('Rootstock', "https://public-node.testnet.rsk.co"),
        BOB_API: "https://rpc.testnet.gobob.xyz",
        ARK_API: "https://asp.testnet.ark.org",
        MAVEN_API: "https://api.testnet.maven.org",
        STATE_CHAIN_API: "https://api.testnet.statechains.org",
        B2_API: "https://rpc.testnet.bsquared.network",
        BOTANIX_API: "https://node.botanixlabs.xyz",
        MEZO_API: "https://rpc.testnet.mezo.org",
        ALPEN_API: "https://rpc.testnet.alpenlabs.com",
        ZULU_API: "https://rpc.testnet.zulu.network",
        BISON_API: "https://rpc.testnet.bisonlabs.io",
        HEMI_API: "https://rpc.testnet.hemi.network",
        NUBIT_API: "https://rpc.testnet.nubit.org",
        LORENZO_API: "https://rpc.testnet.lorenzo-protocol.xyz",
        CITREA_API: "https://rpc.testnet.citrea.xyz",
        BABYLON_API: "https://rpc.testnet.babylonchain.io",
        MERLIN_API: "https://rpc.testnet.merlinchain.io",
        BITLAYER_API: "https://rpc.testnet.bitlayer.org",
        RGB_API: envValue('VITE_RGB_PROXY_URL') || `${gateway}/rgb`,
        BITVM_API: envValue('VITE_BITVM_VERIFY_URL') || `${gateway}/bitvm`,
        BISQ_API: envValue('VITE_BISQ_PROXY_URL') || `${gateway}/bisq`,
        CHANGELLY_API: envValue('VITE_CHANGELLY_PROXY_URL') || `${gateway}/changelly`
      };
    case 'regtest':
      return {
        BTC_API: "http://127.0.0.1:3002/api",
        STX_API: "http://127.0.0.1:3999",
        LIQUID_API: "http://127.0.0.1:7040",
        RSK_API: "http://127.0.0.1:4444",
        BOB_API: "http://127.0.0.1:8545",
        ARK_API: "http://127.0.0.1:3535",
        MAVEN_API: "http://127.0.0.1:7070",
        STATE_CHAIN_API: "http://127.0.0.1:5050",
        B2_API: "http://127.0.0.1:8545",
        BOTANIX_API: "http://127.0.0.1:8546",
        MEZO_API: "http://127.0.0.1:8547",
        ALPEN_API: "http://127.0.0.1:8548",
        ZULU_API: "http://127.0.0.1:8549",
        BISON_API: "http://127.0.0.1:8550",
        HEMI_API: "http://127.0.0.1:8551",
        NUBIT_API: "http://127.0.0.1:8552",
        LORENZO_API: "http://127.0.0.1:8553",
        CITREA_API: "http://127.0.0.1:8554",
        BABYLON_API: "http://127.0.0.1:8555",
        MERLIN_API: "http://127.0.0.1:8556",
        BITLAYER_API: "http://127.0.0.1:8557",
        RGB_API: envValue('VITE_RGB_PROXY_URL') || `${gateway}/rgb`,
        BITVM_API: envValue('VITE_BITVM_VERIFY_URL') || `${gateway}/bitvm`,
        BISQ_API: envValue('VITE_BISQ_PROXY_URL') || `${gateway}/bisq`,
        CHANGELLY_API: envValue('VITE_CHANGELLY_PROXY_URL') || `${gateway}/changelly`
      };
    default:
      return {
        BTC_API: getSovereignEndpoint('Bitcoin L1', "https://mempool.space/api"),
        STX_API: getSovereignEndpoint('Stacks L2', "https://api.mainnet.hiro.so"),
        LIQUID_API: getSovereignEndpoint('Liquid', "https://blockstream.info/liquid/api"),
        RSK_API: getSovereignEndpoint('Rootstock', "https://public-node.rsk.co"),
        BOB_API: "https://rpc.gobob.xyz",
        ARK_API: "https://asp.ark.org",
        MAVEN_API: "https://api.maven.org",
        STATE_CHAIN_API: "https://api.statechains.org",
        B2_API: "https://rpc.bsquared.network",
        BOTANIX_API: "https://node.botanix.chain",
        MEZO_API: "https://rpc.mezo.org",
        ALPEN_API: "https://rpc.alpenlabs.com",
        ZULU_API: "https://rpc.zulu.network",
        BISON_API: "https://rpc.bisonlabs.io",
        HEMI_API: "https://rpc.hemi.network",
        NUBIT_API: "https://rpc.nubit.org",
        LORENZO_API: "https://rpc.lorenzo-protocol.xyz",
        CITREA_API: "https://rpc.citrea.xyz",
        BABYLON_API: "https://rpc.babylonchain.io",
        MERLIN_API: "https://rpc.merlinchain.io",
        BITLAYER_API: "https://rpc.bitlayer.org",
        RGB_API: envValue('VITE_RGB_PROXY_URL') || `${gateway}/rgb`,
        BITVM_API: envValue('VITE_BITVM_VERIFY_URL') || `${gateway}/bitvm`,
        BISQ_API: envValue('VITE_BISQ_PROXY_URL') || `${gateway}/bisq`,
        CHANGELLY_API: envValue('VITE_CHANGELLY_PROXY_URL') || `${gateway}/changelly`
      };
  }
}

/**
 * Robust fetch wrapper with exponential backoff and timeout.
 * Now supports Tor-simulated routing for Privacy v2.
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries = 3,
    backoff = 500,
    isTorEnabled: boolean = false
): Promise<Response> {
  try {
    let finalUrl = url;
    const finalOptions = { ...options };

    if (isTorEnabled) {
        // Tor Bridge / Privacy Proxy implementation
        // Defaulting to gateway's tor route
        const gateway = getGatewayUrl('mainnet'); // default to mainnet gateway for routing if not specified
        const proxyUrl = envValue('VITE_TOR_PROXY_URL') || `${gateway}/tor`;
        finalUrl = `${proxyUrl}/route?url=${encodeURIComponent(url)}`;
        finalOptions.headers = {
            ...finalOptions.headers,
            'X-Sovereign-Tor': 'true',
            'X-Tor-Circuit-ID': generateRandomString(12)
        };
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12000); // Increased timeout for Tor
    const response = await fetch(finalUrl, { ...finalOptions, signal: controller.signal });
    clearTimeout(id);
    
    if (!response.ok) {
        if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`);
        return response;
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2, isTorEnabled);
    }
    throw err;
  }
}

/**
 * Sanitizes error objects to prevent leaking internal stack traces,
 * sensitive API responses, or system details to the UI or logs.
 */
export function sanitizeError(error: any, defaultMsg: string = 'Protocol Error'): string {
  if (!error) return defaultMsg;

  let message: string;
  let fullScan: string;

  if (typeof error === 'string') {
    message = error;
    fullScan = error;
  } else {
    // Defense-in-depth: Extract from more potential fields while scanning the whole object
    message = error.message || error.reason || error.error || error.statusText || String(error) || defaultMsg;
    try {
      fullScan = JSON.stringify(error);
    } catch {
      fullScan = String(error);
    }
  }

  // Blacklist of potentially sensitive words or patterns
  const sensitivePatterns = [
    /stack/i, /at /i, /node_modules/i, /0x[a-fA-F0-9]{40}/i, // stack traces and hex addresses
    /rpc/i, /internal/i, /database/i, /query/i, /connect/i, /__/,
    /\b([a-z]{3,}\s){11,23}[a-z]{3,}\b/i, // BIP-39 mnemonic phrases
    /\b(0x)?[a-fA-F0-9]{64,66}\b/i,         // Hex secrets (Private Keys, TxIDs, Node IDs)
    /\b([xtuvyz](?:pub|prv)[1-9A-HJ-NP-Za-km-z]{50,110})\b/i, // BIP32 extended keys (pub/prv)
    /\b(bc1[qp][a-z0-9]{38,58}|[13][a-km-zA-NP-Z1-9]{25,39}|tb1[qp][a-z0-9]{38,58}|[mn2][a-km-zA-NP-Z1-9]{25,39})\b/i, // BTC
    /\b(S[PST][0-9A-Z]{28,41})\b/i, // Stacks
    /\b((?:lq|tlq|elq)1[qp][a-z0-9]{38,110})\b/i, // Liquid
    /\b(nsec1[a-z0-9]{50,110}|npub1[a-z0-9]{50,110})\b/i, // Nostr
    /\b(sp1[a-z0-9]{50,120})\b/i, // Silent Payments
    /\b[5KL9c][1-9A-HJ-NP-Za-km-z]{50,51}\b/i, // WIF Private Keys
    /\bln(?:bc|tb|bcrt|dev)[0-9a-z]+\b/i      // BOLT11 Invoices
  ];

  // Defensive: check the entire error object for ANY leakage
  if (sensitivePatterns.some(p => p.test(fullScan)) || (typeof message === 'string' && sensitivePatterns.some(p => p.test(message)))) {
    return defaultMsg;
  }

  // Slice to avoid giant response bodies leaking
  return typeof message === 'string' ? message.substring(0, 100) : defaultMsg;
}
