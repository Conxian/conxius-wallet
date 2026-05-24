import { describe, it, expect, vi } from 'vitest';
import { enforcePhase6Guard, PHASE6_FLAGS } from '../services/security-constants';

describe('Phase 6 Runtime Guards', () => {
  it('should throw error when flag is disabled', () => {
    // Force disabled for test
    (PHASE6_FLAGS as any).PHASE6_AGENTOPS_READS_ENABLED = false;

    expect(() => enforcePhase6Guard('PHASE6_AGENTOPS_READS_ENABLED', 'Test read'))
      .toThrow('PHASE6 violation: PHASE6_AGENTOPS_READS_ENABLED is disabled');
  });

  it('should not throw when flag is enabled', () => {
    // Force enabled for test
    (PHASE6_FLAGS as any).PHASE6_UBI_ENFORCEMENT_ENABLED = true;

    expect(() => enforcePhase6Guard('PHASE6_UBI_ENFORCEMENT_ENABLED', 'Test UBI'))
      .not.toThrow();
  });
});
