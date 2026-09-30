import { describe, it, expect } from 'vitest';
import { humanizeRule, checkPolicyCompliance, generatePolicyScript, DEFAULT_POLICIES } from '../services/smart-wallet';

describe('Smart Wallet: Policy Logic', () => {
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

  it('should derive a valid Taproot (P2TR) scriptPubKey for a policy', () => {
    const internalPubKey = new Uint8Array(32).fill(2); // 32-byte dummy x-only pubkey
    const policy = DEFAULT_POLICIES[0];
    const script = generatePolicyScript(policy, internalPubKey);

    expect(script).toBeInstanceOf(Buffer);
    expect(script.length).toBe(34); // OP_1 (1 byte) + PUSH32 (1 byte) + 32-byte tweaked key
    expect(script[0]).toBe(0x51); // OP_1 for SegWit v1 (Taproot)
    expect(script[1]).toBe(0x20); // 32-byte push
  });
});
