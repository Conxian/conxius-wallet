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

  it('should have bridge methods in WalletViewModel', () => {
    const vmContent = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/kotlin/com/conxius/wallet/viewmodel/WalletViewModel.kt'), 'utf8');

    expect(vmContent).toContain('fun createStakingTx(amount: Long)');
    expect(vmContent).toContain('babylonManager.createStakingTx');
  });
});
