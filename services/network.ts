import { Network } from '../types';
import { generateRandomString } from './random';

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

export function endpointsFor(network: Network) {
  const gateway = getGatewayUrl(network);

  switch (network) {
    case 'testnet':
      return {
        BTC_API: "https://mempool.space/testnet/api",
        STX_API: "https://api.testnet.hiro.so",
        LIQUID_API: "https://blockstream.info/liquidtestnet/api",
        RSK_API: "https://public-node.testnet.rsk.co",
        BOB_API: "https://rpc.testnet.gobob.xyz",
        ARK_API: "https://asp.testnet.ark.org",
        MAVEN_API: "https://api.testnet.maven.org",
        STATE_CHAIN_API: "https://api.testnet.statechains.org",
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
        RGB_API: envValue('VITE_RGB_PROXY_URL') || `${gateway}/rgb`,
        BITVM_API: envValue('VITE_BITVM_VERIFY_URL') || `${gateway}/bitvm`,
        BISQ_API: envValue('VITE_BISQ_PROXY_URL') || `${gateway}/bisq`,
        CHANGELLY_API: envValue('VITE_CHANGELLY_PROXY_URL') || `${gateway}/changelly`
      };
    default:
      return {
        BTC_API: "https://mempool.space/api",
        STX_API: "https://api.mainnet.hiro.so",
        LIQUID_API: "https://blockstream.info/liquid/api",
        RSK_API: "https://public-node.rsk.co",
        BOB_API: "https://rpc.gobob.xyz",
        ARK_API: "https://asp.ark.org",
        MAVEN_API: "https://api.maven.org",
        STATE_CHAIN_API: "https://api.statechains.org",
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
