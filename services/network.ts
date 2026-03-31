import { Network, AppState } from '../types';
import { generateRandomString } from './random';
import { NORMALIZE_REGEX, SENSITIVE_PATTERNS } from './security-constants';

let _globalAppState: AppState | undefined;

export const setGlobalAppState = (state: AppState) => {
  _globalAppState = state;
};

function envValue(key: string): string | undefined {
  const value = (import.meta as any).env?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

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

export function endpointsFor(network: Network, appState?: AppState) {
  const gateway = getGatewayUrl(network);
  const state = appState || _globalAppState;
  const strategy = state?.rpcStrategy || 'Sovereign-First';
  const customNodes = state?.customNodes || [];

  const getSovereignEndpoint = (layer: string, defaultPublic: string): string => {
      if (strategy === 'Public-Only') return defaultPublic;
      const custom = customNodes.find(n => n.layer === layer && n.isActive);
      return custom?.endpoint || defaultPublic;
  };

  switch (network) {
    case 'regtest':
      return {
        BTC_API: getSovereignEndpoint('Bitcoin L1', "http://127.0.0.1:8080"),
        STX_API: getSovereignEndpoint('Stacks L2', "http://127.0.0.1:3999"),
        LIQUID_API: getSovereignEndpoint('Liquid', "http://127.0.0.1:3001"),
        RSK_API: getSovereignEndpoint('Rootstock', "http://127.0.0.1:4444"),
        BOB_API: "http://127.0.0.1:8545",
        ARK_API: "http://127.0.0.1:3000",
        MAVEN_API: "http://127.0.0.1:8081",
        STATE_CHAIN_API: "http://127.0.0.1:8082",
        B2_API: "http://127.0.0.1:8546",
        BOTANIX_API: "http://127.0.0.1:8547",
        MEZO_API: "http://127.0.0.1:8548",
        ALPEN_API: "http://127.0.0.1:8549",
        ZULU_API: "http://127.0.0.1:8550",
        BISON_API: "http://127.0.0.1:8551",
        HEMI_API: "http://127.0.0.1:8552",
        NUBIT_API: "http://127.0.0.1:8553",
        LORENZO_API: "http://127.0.0.1:8554",
        CITREA_API: "http://127.0.0.1:8555",
        BABYLON_API: "http://127.0.0.1:8556",
        MERLIN_API: "http://127.0.0.1:8557",
        BITLAYER_API: "http://127.0.0.1:8558",
        RGB_API: `${gateway}/rgb`,
        BITVM_API: `${gateway}/bitvm`,
        BISQ_API: `${gateway}/bisq`,
        CHANGELLY_API: `${gateway}/changelly`
      };
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
        NUBIT_API: "https://rpc.nubit.org",
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
        const gateway = getGatewayUrl('mainnet');
        const proxyUrl = envValue('VITE_TOR_PROXY_URL') || `${gateway}/tor`;
        finalUrl = `${proxyUrl}/route?url=${encodeURIComponent(url)}`;
        finalOptions.headers = {
            ...finalOptions.headers,
            'X-Sovereign-Tor': 'true',
            'X-Tor-Circuit-ID': generateRandomString(12)
        };
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12000);
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
 * Sanitizes error objects to prevent leaking internal technical details.
 */
export function sanitizeError(error: any, defaultMsg: string = 'Protocol Error'): string {
  if (!error) return defaultMsg;

  let message: string;
  let fullScan: string;

  if (typeof error === 'string') {
    message = error;
    fullScan = error;
  } else {
    message = error.message || error.reason || error.error || error.statusText || String(error) || defaultMsg;
    try {
      const seen = new WeakSet();
      fullScan = JSON.stringify(error, (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
          // Ensure Error objects have their non-enumerable properties included in the scan
          if (value instanceof Error) {
            const safeStack = value.stack
              ? value.stack.replace(/at /g, "@@ ").replace(/node_modules/g, "nm_")
              : "";
            return {
              ...value,
              name: value.name,
              message: value.message,
              trace: safeStack
            };
          }
        }
        return value;
      });
    } catch {
      fullScan = String(error) + (error.stack ? ` ${error.stack}` : "");
    }
  }

  const strippedScan = fullScan.replace(NORMALIZE_REGEX, "");
  const spacedScan = fullScan.replace(NORMALIZE_REGEX, " ");
  const strippedMessage = String(message).replace(NORMALIZE_REGEX, "");
  const spacedMessage = String(message).replace(NORMALIZE_REGEX, " ");

  if (SENSITIVE_PATTERNS.some((p) => p.test(strippedScan) || p.test(spacedScan) || p.test(strippedMessage) || p.test(spacedMessage))) {
    return defaultMsg;
  }

  const cleanMessage = typeof message === 'string' ? message.replace(NORMALIZE_REGEX, "") : defaultMsg;
  return typeof cleanMessage === 'string' ? cleanMessage.substring(0, 100) : defaultMsg;
}
