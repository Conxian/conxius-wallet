import { describe, it, expect } from 'vitest';
import * as protocol from '../services/protocol';
import * as fs from 'fs';
import * as path from 'path';

describe('Protocol and Signer Alignment', () => {
  const supportedLayers = [
    'Mainnet', 'Stacks', 'Rootstock', 'Ethereum', 'Lightning', 'Liquid', 'Runes', 'Ordinals', 'BOB', 'RGB', 'Ark', 'BitVM', 'StateChain', 'Maven', 'B2', 'Botanix', 'Mezo',
    'Alpen', 'Zulu', 'Bison', 'Hemi', 'Nubit', 'Lorenzo', 'Citrea', 'Babylon', 'Merlin', 'Bitlayer', 'TaprootAssets', 'Silent'
  ];

  it('should have fetchers for all supported layers', () => {
    const protocolContent = fs.readFileSync(path.join(process.cwd(), 'services/protocol.ts'), 'utf8');

    const expectedFetchers = [
      'fetchBtcBalance', 'fetchBobAssets', 'fetchRgbAssets', 'fetchArkBalances',
      'fetchB2Assets', 'fetchBotanixAssets', 'fetchMezoAssets',
      'fetchAlpenAssets', 'fetchZuluAssets', 'fetchBisonAssets', 'fetchHemiAssets', 'fetchNubitAssets',
      'fetchLorenzoAssets', 'fetchCitreaAssets', 'fetchBabylonAssets', 'fetchMerlinAssets', 'fetchBitlayerAssets',
      'fetchTaprootAssets'
    ];
    expectedFetchers.forEach(fetcher => {
      expect(protocolContent).toContain(fetcher);
    });
  });

  it('should have signer logic for all supported layers', () => {
    const signerContent = fs.readFileSync(path.join(process.cwd(), 'services/app-private/value-operation-signer.ts'), 'utf8');
    const nativeSignerContent = fs.readFileSync(path.join(process.cwd(), 'services/app-private/native-value-signing.ts'), 'utf8');

    supportedLayers.filter((layer) => layer !== 'StateChain').forEach(layer => {
      expect(signerContent).toMatch(new RegExp(`\\b${layer}: ["']m/`));
    });
    expect(signerContent).toContain("request.layer === 'StateChain'");
    expect(nativeSignerContent).toContain('NATIVE_VALUE_SIGNER_REQUIRED');
    expect(signerContent).not.toContain('workerManager.derivePath');
  });

  it.skip('should have native parsePayload support for all layers', () => {
    const enclaveContent = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/kotlin/com/conxius/wallet/SecureEnclavePlugin.kt'), 'utf8');

    const expectedNetworks = [
      'stacks', 'mainnet', 'ark', 'rgb', 'statechain', 'maven', 'bitvm', 'liquid', 'bob', 'b2', 'botanix', 'mezo',
      'alpen', 'zulu', 'bison', 'hemi', 'nubit', 'lorenzo', 'citrea', 'babylon', 'merlin', 'bitlayer', 'taprootassets'
    ];
    expectedNetworks.forEach(net => {
      expect(enclaveContent.toLowerCase()).toContain('"' + net + '"');
    });
  });
});
