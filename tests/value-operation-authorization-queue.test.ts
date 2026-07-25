import { describe, expect, it, vi } from 'vitest';
import { createValueOperationAuthorizationQueue } from '../services/value-operation-authorization-queue';
import {
    createDeterministicValueOperationIntent,
    unavailableValueOperationEvidence,
    type ValueOperationAuthorizationRequest,
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
});
