import { describe, it, expect } from 'vitest';
import * as protocol from '../services/protocol';
import * as signer from '../services/signer';
import * as fs from 'fs';
import * as path from 'path';

describe('Protocol and Signer Alignment', () => {
  const supportedLayers = [
    'Mainnet', 'Stacks', 'Liquid', 'BOB', 'RGB', 'Ark', 'StateChain', 'Maven', 'BitVM', 'Rootstock'
  ];

  it('should have fetchers for all supported layers', () => {
    const protocolContent = fs.readFileSync(path.join(process.cwd(), 'services/protocol.ts'), 'utf8');

    expect(protocolContent).toContain('fetchStacksBalances');
    expect(protocolContent).toContain('fetchLiquidBalance');
    expect(protocolContent).toContain('fetchBobAssets');
    expect(protocolContent).toContain('fetchRgbAssets');
    expect(protocolContent).toContain('fetchArkBalances');
    expect(protocolContent).toContain('fetchStateChainBalances');
    expect(protocolContent).toContain('fetchMavenAssets');
  });

  it('should have signer logic for all supported layers', () => {
    const signerContent = fs.readFileSync(path.join(process.cwd(), 'services/signer.ts'), 'utf8');

    supportedLayers.forEach(layer => {
      expect(signerContent).toContain(`layer === "${layer}"`);
    });
  });

  it('should have native parsePayload support for all layers', () => {
    const enclaveContent = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/java/com/conxius/wallet/SecureEnclavePlugin.java'), 'utf8');

    const expectedNetworks = ['stacks', 'mainnet', 'ark', 'rgb', 'statechain', 'maven', 'bitvm', 'liquid', 'bob'];
    expectedNetworks.forEach(net => {
      expect(enclaveContent).toContain(`"${net}".equals(networkStr)`);
    });
  });
});
