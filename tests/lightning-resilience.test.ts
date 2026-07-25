import { describe, it, expect, vi } from 'vitest';
import {
  isValidPaymentTransition,
  checkIdempotency,
  savePaymentIntent,
  classifyLightningError,
  getPaymentIntent
} from '../services/lightning';
import { getLightningBackend } from '../services/lightning-backend';
import { ValueOperationSettlementAuthorization } from '../services/value-operation';
import { createAppPrivateValueOperationAuthority } from '../services/app-private/value-operation-authority';

describe('Lightning Resilience SRL-1 & SRL-2', () => {
  it('validates state transitions strictly', () => {
    expect(isValidPaymentTransition('INTENT_ACCEPTED', 'EXECUTION_IN_FLIGHT')).toBe(true);
    expect(isValidPaymentTransition('EXECUTION_IN_FLIGHT', 'SETTLED')).toBe(true);
    expect(isValidPaymentTransition('SETTLED', 'FAILED_CLOSED')).toBe(false);
    expect(isValidPaymentTransition('INTENT_ACCEPTED', 'FAILED_CLOSED')).toBe(true);
    // Self-transition should be false to enforce change
    expect(isValidPaymentTransition('EXECUTION_IN_FLIGHT', 'EXECUTION_IN_FLIGHT')).toBe(false);
  });

  it('enforces idempotency and detects conflicts', () => {
    const key = 'test_key';
    const fingerprint = 'fp1';
    const intent: any = {
      id: '1',
      idempotencyKey: key,
      fingerprint: fingerprint,
      state: 'INTENT_ACCEPTED',
      attemptNo: 1,
      occurredAt: Date.now()
    };

    savePaymentIntent(intent);

    // Exact match
    const existing = checkIdempotency(key, fingerprint);
    expect(existing).not.toBeNull();
    expect(existing?.id).toBe('1');

    // Conflict match (same key, different fingerprint)
    expect(() => checkIdempotency(key, 'different_fp')).toThrow(/409 Conflict/);
  });

  it('quarantines the legacy Breez backend settlement entrypoint', async () => {
     const backend = getLightningBackend({ type: 'Breez' });
     const key = 'concurrent_key';
     const fingerprint = 'fp1';

     // Setup an in-flight intent
     const intent: any = {
        id: '2',
        idempotencyKey: key,
        fingerprint: fingerprint,
        state: 'EXECUTION_IN_FLIGHT',
        attemptNo: 1,
        occurredAt: Date.now()
     };
     savePaymentIntent(intent);

     await expect(backend.payInvoice(
       'invoice',
       1,
       { kind: 'value-operation-settlement-authorization' } as ValueOperationSettlementAuthorization,
       'mainnet',
       createAppPrivateValueOperationAuthority('test-vault').consumer,
       key,
       fingerprint,
     )).rejects.toThrow('BREEZ_BACKEND_SETTLEMENT_QUARANTINED');
  });
});

describe('Lightning Failure Taxonomy SRL-7', () => {
  it('classifies errors correctly', () => {
    expect(classifyLightningError(new Error('Invoice expired'))).toBe('PERMANENT');
    expect(classifyLightningError(new Error('Network timeout'))).toBe('TRANSIENT');
    expect(classifyLightningError(new Error('Unknown generic error'))).toBe('INDETERMINATE');
  });
});
