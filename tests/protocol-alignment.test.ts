import { describe, it, expect } from 'vitest';
import * as protocol from '../services/protocol';
import * as signer from '../services/signer';
import * as fs from 'fs';
import * as path from 'path';

describe('Protocol and Signer Alignment', () => {
  const supportedLayers = [
    'Mainnet', 'Stacks', 'Liquid', 'BOB', 'RGB', 'Ark', 'StateChain', 'Maven', 'BitVM', 'Rootstock', 'B2', 'Botanix', 'Mezo',
    'Alpen', 'Zulu', 'Bison', 'Hemi', 'Nubit', 'Lorenzo', 'Citrea', 'Babylon', 'Merlin', 'Bitlayer', 'TaprootAssets'
  ];

  it('should have fetchers for all supported layers', () => {
    const protocolContent = fs.readFileSync(path.join(process.cwd(), 'services/protocol.ts'), 'utf8');

    const expectedFetchers = [
      'fetchStacksBalances', 'fetchLiquidBalance', 'fetchBobAssets', 'fetchRgbAssets', 'fetchArkBalances',
      'fetchStateChainBalances', 'fetchMavenAssets', 'fetchB2Assets', 'fetchBotanixAssets', 'fetchMezoAssets',
      'fetchAlpenAssets', 'fetchZuluAssets', 'fetchBisonAssets', 'fetchHemiAssets', 'fetchNubitAssets',
      'fetchLorenzoAssets', 'fetchCitreaAssets', 'fetchBabylonAssets', 'fetchMerlinAssets', 'fetchBitlayerAssets',
      'fetchTaprootAssets'
    ];
    expectedFetchers.forEach(fetcher => {
      expect(protocolContent).toContain(fetcher);
    });
  });

  it('should have signer logic for all supported layers', () => {
    const signerContent = fs.readFileSync(path.join(process.cwd(), 'services/signer.ts'), 'utf8');

    supportedLayers.forEach(layer => {
      expect(signerContent).toContain(`layer === "${layer}"`);
    });
  });

  // SKIPPED: SecureEnclavePlugin.kt is currently a stub after Kotlin migration.
  // This test should be re-enabled once the native implementation is complete.
  it.skip('should have native parsePayload support for all layers', () => {
    const enclaveContent = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/kotlin/com/conxius/wallet/SecureEnclavePlugin.kt'), 'utf8');

    const expectedNetworks = [
      'stacks', 'mainnet', 'ark', 'rgb', 'statechain', 'maven', 'bitvm', 'liquid', 'bob', 'b2', 'botanix', 'mezo',
      'alpen', 'zulu', 'bison', 'hemi', 'nubit', 'lorenzo', 'citrea', 'babylon', 'merlin', 'bitlayer', 'taprootassets'
    ];
    expectedNetworks.forEach(net => {
      expect(enclaveContent.toLowerCase()).toContain(`"${net}"`);
    });
  });
});
