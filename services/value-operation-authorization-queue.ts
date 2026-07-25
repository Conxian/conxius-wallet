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
    settled: boolean;
}

export interface ValueOperationAuthorizationQueue {
    enqueue(request: ValueOperationAuthorizationRequest): Promise<ValueOperationGateOutcome>;
    completeActive(confirmation: 'confirmed' | 'cancelled'): Promise<void>;
    active(): PreparedValueOperationAuthorizationRequest | null;
    dispose(): void;
}

export function createValueOperationAuthorizationQueue(
    onActiveChanged: (request: PreparedValueOperationAuthorizationRequest | null) => void,
    authorize = requestValueOperationAuthorization,
): ValueOperationAuthorizationQueue {
    const pending: QueueEntry[] = [];
    const unsettled = new Set<QueueEntry>();
    let current: QueueEntry | null = null;
    let disposed = false;

    const resolveOnce = (entry: QueueEntry, outcome: ValueOperationGateOutcome) => {
        if (entry.settled) return;
        entry.settled = true;
        unsettled.delete(entry);
        entry.resolve(outcome);
    };

    const activateNext = () => {
        if (disposed || current) return;
        const next = pending.shift();
        if (!next) return;
        current = next;
        onActiveChanged(next.request);
    };

    const queue: ValueOperationAuthorizationQueue = {
        enqueue(request: ValueOperationAuthorizationRequest): Promise<ValueOperationGateOutcome> {
            if (disposed) return Promise.resolve({ kind: 'rejected', reason: 'user_cancelled' });
            let prepared: PreparedValueOperationAuthorizationRequest;
            try {
                prepared = prepareValueOperationAuthorization(request);
            } catch {
                return Promise.resolve({ kind: 'rejected', reason: 'malformed_value_operation' } as const);
            }
            return new Promise<ValueOperationGateOutcome>((resolve) => {
                const entry: QueueEntry = { request: prepared, resolve, settled: false };
                pending.push(entry);
                unsettled.add(entry);
                activateNext();
            });
        },

        async completeActive(confirmation: 'confirmed' | 'cancelled'): Promise<void> {
            if (disposed) return;
            const entry = current;
            if (!entry) return;
            current = null;
            onActiveChanged(null);
            activateNext();
            let outcome: ValueOperationGateOutcome;
            try {
                outcome = await authorize(entry.request, confirmation);
            } catch {
                outcome = { kind: 'quarantined', reason: 'unavailable_provider_evidence' };
            }
            resolveOnce(entry, outcome);
        },

        active(): PreparedValueOperationAuthorizationRequest | null {
            return current?.request ?? null;
        },

        dispose(): void {
            if (disposed) return;
            disposed = true;
            current = null;
            pending.length = 0;
            for (const entry of [...unsettled]) {
                resolveOnce(entry, { kind: 'rejected', reason: 'user_cancelled' });
            }
        },
    };
    return Object.freeze(queue);
}
