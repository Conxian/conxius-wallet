import { describe, expect, it, vi } from 'vitest';
import { createValueOperationAuthorizationQueue } from '../services/value-operation-authorization-queue';
import {
    createDeterministicValueOperationIntent,
    unavailableValueOperationEvidence,
    type ValueOperationAuthorizationRequest,
    type ValueOperationGateOutcome,
} from '../services/value-operations';

function request(destination: string): ValueOperationAuthorizationRequest {
    return {
        intent: createDeterministicValueOperationIntent({
            operationType: 'bitcoin-transfer',
            chain: 'bitcoin',
            layer: 'l1',
            payload: { destination, amountSats: '1000' },
            network: 'testnet',
            purpose: 'queue-test',
            domain: 'conxius.wallet',
            audience: 'native-value-signer',
        }),
        summary: {
            title: 'Authorize transfer',
            action: 'Send Bitcoin',
            amount: '1000 sats',
            destination,
            network: 'testnet',
            purpose: 'Queue test',
        },
        custody: {
            boundary: 'wallet-native-enclave',
            protocolKeyIdentity: 'bitcoin-account-0',
            algorithm: 'secp256k1-ecdsa',
        },
        evidence: unavailableValueOperationEvidence('queue-test'),
    };
}

describe('value-operation authorization queue', () => {
    it('serializes requests and returns typed cancellation instead of a boolean', async () => {
        const activeChanged = vi.fn();
        const queue = createValueOperationAuthorizationQueue(activeChanged);
        const first = queue.enqueue(request('tb1-first'));
        const second = queue.enqueue(request('tb1-second'));

        expect(queue.active()?.summary.destination).toBe('tb1-first');
        expect(activeChanged).toHaveBeenCalledTimes(1);

        await queue.completeActive('cancelled');
        await expect(first).resolves.toEqual({ kind: 'rejected', reason: 'user_cancelled' });
        expect(queue.active()?.summary.destination).toBe('tb1-second');

        await queue.completeActive('cancelled');
        await expect(second).resolves.toEqual({ kind: 'rejected', reason: 'user_cancelled' });
        expect(queue.active()).toBeNull();
    });

    it('disposes the active and every queued request without dangling promises or callbacks', async () => {
        const activeChanged = vi.fn();
        const queue = createValueOperationAuthorizationQueue(activeChanged);
        const first = queue.enqueue(request('tb1-first'));
        const second = queue.enqueue(request('tb1-second'));
        const third = queue.enqueue(request('tb1-third'));

        queue.dispose();

        await expect(Promise.all([first, second, third])).resolves.toEqual([
            { kind: 'rejected', reason: 'user_cancelled' },
            { kind: 'rejected', reason: 'user_cancelled' },
            { kind: 'rejected', reason: 'user_cancelled' },
        ]);
        expect(queue.active()).toBeNull();
        expect(activeChanged).toHaveBeenCalledTimes(1);
        await expect(queue.enqueue(request('tb1-after-dispose'))).resolves.toEqual({
            kind: 'rejected', reason: 'user_cancelled',
        });
        await queue.completeActive('confirmed');
        expect(activeChanged).toHaveBeenCalledTimes(1);
    });

    it('allows only one confirmation to act on an active request', async () => {
        const authorize = vi.fn().mockResolvedValue({ kind: 'rejected', reason: 'user_cancelled' });
        const queue = createValueOperationAuthorizationQueue(vi.fn(), authorize);
        const outcome = queue.enqueue(request('tb1-once'));

        await Promise.all([queue.completeActive('confirmed'), queue.completeActive('cancelled')]);

        expect(authorize).toHaveBeenCalledOnce();
        await expect(outcome).resolves.toEqual({ kind: 'rejected', reason: 'user_cancelled' });
    });

    it('keeps a newly enqueued request active while the prior authorization completes', async () => {
        let resolveFirst!: (value: any) => void;
        const firstAuthorization = new Promise((resolve) => { resolveFirst = resolve; });
        const authorize = vi.fn()
            .mockReturnValueOnce(firstAuthorization)
            .mockResolvedValueOnce({ kind: 'rejected', reason: 'user_cancelled' });
        const activeChanged = vi.fn();
        const queue = createValueOperationAuthorizationQueue(activeChanged, authorize);
        const first = queue.enqueue(request('tb1-first'));
        const completing = queue.completeActive('confirmed');
        const second = queue.enqueue(request('tb1-second'));

        expect(queue.active()?.summary.destination).toBe('tb1-second');
        resolveFirst({ kind: 'unsupported', reason: 'unsupported_provider' });
        await completing;
        await expect(first).resolves.toEqual({ kind: 'unsupported', reason: 'unsupported_provider' });
        expect(queue.active()?.summary.destination).toBe('tb1-second');

        await queue.completeActive('cancelled');
        await expect(second).resolves.toEqual({ kind: 'rejected', reason: 'user_cancelled' });
    });

    it('maps authorization throws to a typed unavailable outcome', async () => {
        const queue = createValueOperationAuthorizationQueue(vi.fn(), vi.fn().mockRejectedValue(new Error('gate unavailable')));
        const outcome = queue.enqueue(request('tb1-throw'));

        await queue.completeActive('confirmed');

        await expect(outcome).resolves.toEqual({ kind: 'quarantined', reason: 'unavailable_provider_evidence' });
    });

    it('resolves an in-flight authorization as cancelled when disposed and ignores its late result', async () => {
        let resolveAuthorization!: (value: any) => void;
        const authorize = vi.fn((): Promise<ValueOperationGateOutcome> => new Promise((resolve) => {
            resolveAuthorization = resolve;
        }));
        const activeChanged = vi.fn();
        const queue = createValueOperationAuthorizationQueue(activeChanged, authorize);
        const outcome = queue.enqueue(request('tb1-unmount'));
        const completing = queue.completeActive('confirmed');

        queue.dispose();
        await expect(outcome).resolves.toEqual({ kind: 'rejected', reason: 'user_cancelled' });
        resolveAuthorization({ kind: 'authorized' });
        await completing;
        expect(activeChanged).toHaveBeenCalledTimes(2);
    });
});
