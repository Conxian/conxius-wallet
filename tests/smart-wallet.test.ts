import { describe, it, expect } from 'vitest';
import { humanizeRule, checkPolicyCompliance, DEFAULT_POLICIES } from '../services/smart-wallet';

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
});
