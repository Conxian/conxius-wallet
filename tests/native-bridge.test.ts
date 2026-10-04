import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Native Bridge Integrity', () => {
  it('should have all native protocol managers instantiated in ConxiusApplication', () => {
    const appContent = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/kotlin/com/conxius/wallet/ConxiusApplication.kt'), 'utf8');

    expect(appContent).toContain('val babylonManager by lazy { BabylonManager() }');
    expect(appContent).toContain('val dlcManager by lazy { DlcManager() }');
    expect(appContent).toContain('val nwcManager by lazy { NwcManager() }');
  });

  it('should have native protocol managers in ViewModelFactory', () => {
    const factoryContent = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/kotlin/com/conxius/wallet/viewmodel/ViewModelFactory.kt'), 'utf8');

    expect(factoryContent).toContain('private val babylonManager: BabylonManager');
    expect(factoryContent).toContain('private val dlcManager: DlcManager');
    expect(factoryContent).toContain('private val nwcManager: NwcManager');
  });

  it('should have native Taproot/Babylon bridge methods in SecureEnclavePlugin', () => {
    const pluginContent = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/kotlin/com/conxius/wallet/SecureEnclavePlugin.kt'), 'utf8');

    expect(pluginContent).toContain('fun taprootAddress(');
    expect(pluginContent).toContain('fun schnorrSignDigest(');
  });

  it('should have native MuSig2 (BIP-327) bridge methods in SecureEnclavePlugin', () => {
    const pluginContent = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/kotlin/com/conxius/wallet/SecureEnclavePlugin.kt'), 'utf8');

    expect(pluginContent).toContain('fun musig2AggregatePubkeys(');
    expect(pluginContent).toContain('fun musig2SortPubkeys(');
    expect(pluginContent).toContain('fun musig2GenerateNonce(');
    expect(pluginContent).toContain('fun musig2AggregateNonces(');
    expect(pluginContent).toContain('fun musig2SignPartial(');
    expect(pluginContent).toContain('fun musig2VerifyPartial(');
    expect(pluginContent).toContain('fun musig2AggregateSignatures(');
  });
});
