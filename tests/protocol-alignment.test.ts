import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Protocol and Signer Alignment', () => {
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

  it('keeps the legacy signer explicitly non-value and limited to approved message layers', () => {
    const signerContent = fs.readFileSync(path.join(process.cwd(), 'services/signer.ts'), 'utf8');
    expect(signerContent).toContain("readonly layer: 'Mainnet' | 'Nostr'");
    expect(signerContent).toContain('requestNonValueMessageSignature');
    expect(signerContent).not.toMatch(/export\s+(?:const|function)\s+requestEnclaveSignature/);
    for (const legacyValueLayer of ['Stacks', 'Liquid', 'Ark', 'BitVM', 'Maven', 'BOB', 'B2', 'Rootstock', 'RGB', 'StateChain']) {
      expect(signerContent).not.toContain(`request.layer === "${legacyValueLayer}"`);
    }
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
