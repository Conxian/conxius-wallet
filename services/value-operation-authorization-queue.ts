import {
    prepareValueOperationAuthorization,
    requestValueOperationAuthorization,
    type PreparedValueOperationAuthorizationRequest,
    type ValueOperationAuthorizationRequest,
    type ValueOperationGateOutcome,
} from './value-operations';

interface QueueEntry {
    readonly request: PreparedValueOperationAuthorizationRequest;
    readonly resolve: (outcome: ValueOperationGateOutcome) => void;
}

export interface ValueOperationAuthorizationQueue {
    enqueue(request: ValueOperationAuthorizationRequest): Promise<ValueOperationGateOutcome>;
    completeActive(confirmation: 'confirmed' | 'cancelled'): Promise<void>;
    active(): PreparedValueOperationAuthorizationRequest | null;
}

export function createValueOperationAuthorizationQueue(
    onActiveChanged: (request: PreparedValueOperationAuthorizationRequest | null) => void,
): ValueOperationAuthorizationQueue {
    const pending: QueueEntry[] = [];
    let current: QueueEntry | null = null;

    const activateNext = () => {
        if (current) return;
        current = pending.shift() ?? null;
        onActiveChanged(current?.request ?? null);
    };

    const queue: ValueOperationAuthorizationQueue = {
        enqueue(request: ValueOperationAuthorizationRequest): Promise<ValueOperationGateOutcome> {
            let prepared: PreparedValueOperationAuthorizationRequest;
            try {
                prepared = prepareValueOperationAuthorization(request);
            } catch {
                return Promise.resolve({ kind: 'rejected', reason: 'malformed_value_operation' } as const);
            }
            return new Promise<ValueOperationGateOutcome>((resolve) => {
                pending.push({ request: prepared, resolve });
                activateNext();
            });
        },

        async completeActive(confirmation: 'confirmed' | 'cancelled'): Promise<void> {
            const entry = current;
            if (!entry) return;
            current = null;
            onActiveChanged(null);
            let outcome: ValueOperationGateOutcome;
            try {
                outcome = await requestValueOperationAuthorization(entry.request, confirmation);
            } catch {
                outcome = { kind: 'quarantined', reason: 'unavailable_provider_evidence' };
            }
            entry.resolve(outcome);
            activateNext();
        },

        active(): PreparedValueOperationAuthorizationRequest | null {
            return current?.request ?? null;
        },
    };
    return Object.freeze(queue);
}
