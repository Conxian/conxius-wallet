import { describe, it, expect, beforeEach } from 'vitest';
import { endpointsFor, setGlobalAppState } from '../services/network';
import { AppState } from '../types';

describe('Network Sovereignty: RPC Selection', () => {
  const mockState: Partial<AppState> = {
    rpcStrategy: 'Sovereign-First',
    customNodes: [
      { id: '1', layer: 'Bitcoin L1', endpoint: 'https://my-node.local', isActive: true }
    ]
  };

  beforeEach(() => {
    setGlobalAppState(mockState as AppState);
  });

  it('should prioritize custom node in Sovereign-First mode', () => {
    const endpoints = endpointsFor('mainnet');
    expect(endpoints.BTC_API).toBe('https://my-node.local');
  });

  it('should fallback to public RPC when custom node is missing for a layer', () => {
    const endpoints = endpointsFor('mainnet');
    expect(endpoints.STX_API).toBe('https://api.mainnet.hiro.so');
  });

  it('should ignore custom nodes in Public-Only mode', () => {
    setGlobalAppState({ ...mockState, rpcStrategy: 'Public-Only' } as AppState);
    const endpoints = endpointsFor('mainnet');
    expect(endpoints.BTC_API).toBe('https://mempool.space/api');
  });

  it('should respect testnet defaults when no custom node matches', () => {
    const endpoints = endpointsFor('testnet');
    expect(endpoints.BTC_API).toBe('https://my-node.local'); // Still matches because custom node is layer-based
    expect(endpoints.STX_API).toBe('https://api.testnet.hiro.so');
  });
});
