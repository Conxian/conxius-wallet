import { describe, it, expect } from 'vitest';
import { humanizeRule, checkPolicyCompliance, generatePolicyScript, DEFAULT_POLICIES } from '../services/smart-wallet';
import { taggedHash, computeTapTweak } from '../services/ecc';
import { UTXO } from '../types';

describe('Smart Wallet: Policy Logic & BIP-341 Taproot Tweaking', () => {
  it('should humanize Miniscript rules correctly', () => {
    const rules = "and(pk(key1),older(1000))";
    const human = humanizeRule(rules);
    expect(human).toContain('ALL OF');
    expect(human).toContain('Key [key1]');
    expect(human).toContain('Wait 1000 Blocks');
  });

  it('should handle complex humanization', () => {
    const rules = "or(pk(owner),and(pk(heir),older(52560)))";
    const human = humanizeRule(rules);
    expect(human).toContain('EITHER');
    expect(human).toContain('ALL OF');
    expect(human).toContain('Key [owner]');
    expect(human).toContain('Wait 52560 Blocks');
  });

  it('should verify compliance for inactive policies', () => {
    const policy = { ...DEFAULT_POLICIES[0], isActive: false };
    expect(checkPolicyCompliance([], policy)).toBe(true);
  });

  it('should enforce velocity limit policy compliance', () => {
    const velocityPolicy = DEFAULT_POLICIES.find(p => p.type === 'VelocityLimit')!;
    const compliantUtxos: UTXO[] = [{
      txid: 'a',
      vout: 0,
      amount: 500000,
      address: 'bc1p1',
      status: 'confirmed',
      isFrozen: false,
      derivationPath: "m/86'/0'/0'/0/0",
      privacyRisk: 'Low'
    }];
    const nonCompliantUtxos: UTXO[] = [{
      txid: 'b',
      vout: 0,
      amount: 2000000,
      address: 'bc1p2',
      status: 'confirmed',
      isFrozen: false,
      derivationPath: "m/86'/0'/0'/0/1",
      privacyRisk: 'Low'
    }];

    expect(checkPolicyCompliance(compliantUtxos, velocityPolicy)).toBe(true);
    expect(checkPolicyCompliance(nonCompliantUtxos, velocityPolicy)).toBe(false);
  });

  it('should compute valid BIP-341 tagged hashes and TapTweaks', () => {
    const internalPubKey = new Uint8Array(32).fill(2);
    const tag = 'TapTweak';
    const hash = taggedHash(tag, internalPubKey);

    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(32);

    const tweak = computeTapTweak(internalPubKey);
    expect(tweak).toBeInstanceOf(Uint8Array);
    expect(tweak.length).toBe(32);
  });

  it.each(DEFAULT_POLICIES)('rejects uncompiled funding policy $type', (policy) => {
    expect(() => generatePolicyScript(policy, new Uint8Array(32).fill(2)))
      .toThrow('Unsupported policy script generation');
  });

  it.each(['', 'pk(owner)', 'x'.repeat(253), 'x'.repeat(65536)])(
    'does not turn arbitrary expression text into a funding script', (rules) => {
      expect(() => generatePolicyScript({ ...DEFAULT_POLICIES[0], rules }, new Uint8Array()))
        .toThrow('Unsupported policy script generation');
    },
  );

  it.each(['Threshold', 'TimeLock', 'Inheritance', 'SocialRecovery', 'unknown'])(
    'rejects active %s without transaction satisfaction evidence', (type) => {
      const policy = { ...DEFAULT_POLICIES[0], type, isActive: true } as typeof DEFAULT_POLICIES[number];
      expect(checkPolicyCompliance([], policy)).toBe(false);
      expect(checkPolicyCompliance([{ amount: 1 }] as UTXO[], policy)).toBe(false);
    },
  );

  const velocity = DEFAULT_POLICIES.find(p => p.type === 'VelocityLimit')!;
  it.each([NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, '1', undefined])(
    'rejects invalid UTXO amount %s', (amount) => {
      expect(checkPolicyCompliance([{ amount }] as UTXO[], velocity)).toBe(false);
    },
  );

  it.each([NaN, Infinity, -1, 0.5, '100'])('rejects invalid limit %s', (limitSats) => {
    expect(checkPolicyCompliance([], { ...velocity, metadata: { limitSats } })).toBe(false);
  });

  it('honors zero and inclusive limits and rejects unsafe aggregate sums', () => {
    const zero = { ...velocity, metadata: { limitSats: 0 } };
    expect(checkPolicyCompliance([{ amount: 0 }] as UTXO[], zero)).toBe(true);
    expect(checkPolicyCompliance([{ amount: 1 }] as UTXO[], zero)).toBe(false);
    expect(checkPolicyCompliance([{ amount: 1000000 }] as UTXO[], velocity)).toBe(true);
    expect(checkPolicyCompliance([{ amount: 500000 }, { amount: 500001 }] as UTXO[], velocity)).toBe(false);
    const maximum = { ...velocity, metadata: { limitSats: Number.MAX_SAFE_INTEGER } };
    expect(checkPolicyCompliance([{ amount: Number.MAX_SAFE_INTEGER }, { amount: 1 }] as UTXO[], maximum)).toBe(false);
  });
});
