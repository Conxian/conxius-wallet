
import { describe, it, expect } from 'vitest';
import { deriveSovereignRoots } from '../services/signer';
import * as bip39 from 'bip39';

describe('Sovereignty & Key Topology', () => {
  // Generate a random mnemonic for testing to avoid hardcoded secrets
  const mnemonic = bip39.generateMnemonic();

  it('derives correct BIP-84 (Segwit) address', async () => {
    const roots = await deriveSovereignRoots(mnemonic);
    expect(roots.btc).toMatch(/^bc1q/);
  });

  it('derives correct BIP-86 (Taproot) address', async () => {
    const roots = await deriveSovereignRoots(mnemonic);
    expect(roots.taproot).toMatch(/^bc1p/);
  });

  it('derives correct Stacks (m/44/5757) address', async () => {
    const roots = await deriveSovereignRoots(mnemonic);
    expect(roots.stx).toMatch(/^SP/);
  });

  it('derives correct EVM (RSK/ETH) address (m/44/60)', async () => {
    const roots = await deriveSovereignRoots(mnemonic);
    expect(roots.eth).toMatch(/^0x/);
  });

  it('handles BIP-39 passphrase correctly', async () => {
    const passphrase = "conxius_vault";
    const roots1 = await deriveSovereignRoots(mnemonic);
    const roots2 = await deriveSovereignRoots(mnemonic, passphrase);
    expect(roots1.btc).not.toBe(roots2.btc);
  });

  it('handles rapid concurrent derivation requests without state corruption', async () => {
    const requests = Array(10).fill(0).map(() => deriveSovereignRoots(mnemonic));
    const results = await Promise.all(requests);
    const firstBtc = results[0].btc;
    results.forEach(r => expect(r.btc).toBe(firstBtc));
  });
});
