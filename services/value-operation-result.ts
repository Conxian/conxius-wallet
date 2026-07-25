import {
    digestCanonicalPayload,
    type AuthorizedValueOperation,
    type CanonicalValue,
} from './value-operation-gate';
import { inspectAuthorizedValueOperation } from './value-operations';

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export interface AuthorizedValueOperationExecution<TArtifact extends CanonicalValue> {
    readonly authorization: AuthorizedValueOperation;
    readonly artifact: TArtifact;
}

export interface BoundValueArtifact {
    readonly kind: 'conxius.wallet.bound-value-artifact.v1';
    readonly canonicalDigest: string;
}

export type ValueOperationExecutionRejectionReason =
    | 'malformed_execution_request'
    | 'malformed_artifact'
    | 'artifact_digest_mismatch'
    | 'expired_authorization'
    | 'forged_authorization'
    | 'mismatched_authorization';

export interface AdapterProviderReceiptBinding {
    readonly kind: `conxius.wallet.${string}.provider-receipt.v1`;
    readonly envelopeDigest: string;
    readonly artifactDigest: string;
    readonly providerReceiptDigest: string;
}

export interface KnownUnsupportedAdapterBinding {
    readonly artifactKind: `conxius.wallet.${string}.v1`;
    readonly operationType: string;
    readonly layer: string;
    readonly chain?: string;
}

interface BoundExecutionMetadata {
    readonly envelopeDigest: string;
    readonly artifact: BoundValueArtifact;
}

interface ProviderExecutionMetadata extends BoundExecutionMetadata {
    readonly providerReceiptDigest: string;
}

export type ValueOperationExecutionOutcome<
    TSubmittedReceipt extends AdapterProviderReceiptBinding = never,
    TSettledReceipt extends AdapterProviderReceiptBinding = never,
> =
    | Readonly<{ kind: 'rejected'; reason: ValueOperationExecutionRejectionReason }>
    | Readonly<{ kind: 'unsupported'; reason: 'qualified_adapter_unavailable' } & BoundExecutionMetadata>
    | Readonly<{ kind: 'simulated'; reason: string } & BoundExecutionMetadata>
    | Readonly<{ kind: 'quarantined'; reason: string } & ProviderExecutionMetadata>
    | Readonly<{ kind: 'indeterminate'; reason: string } & ProviderExecutionMetadata>
    | Readonly<{ kind: 'submitted'; receipt: TSubmittedReceipt } & ProviderExecutionMetadata>
    | Readonly<{ kind: 'settled'; receipt: TSettledReceipt } & ProviderExecutionMetadata>;

function rejected(reason: ValueOperationExecutionRejectionReason): ValueOperationExecutionOutcome {
    return Object.freeze({ kind: 'rejected', reason });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string') return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
    }
    return true;
}

/** Validates exact binding and returns unsupported without consuming a stage. */
export function knownUnsupportedValueOperation<TArtifact extends CanonicalValue>(
    request: AuthorizedValueOperationExecution<TArtifact> | unknown,
    expected: KnownUnsupportedAdapterBinding,
): ValueOperationExecutionOutcome {
    if (
        !isPlainObject(request)
        || Object.keys(request).length !== 2
        || !Object.hasOwn(request, 'authorization')
        || !Object.hasOwn(request, 'artifact')
    ) {
        return rejected('malformed_execution_request');
    }

    const authorization = request.authorization;
    if (
        !isPlainObject(authorization)
        || authorization.kind !== 'authorized'
        || !isPlainObject(authorization.envelope)
        || typeof authorization.envelopeDigest !== 'string'
        || !DIGEST_PATTERN.test(authorization.envelopeDigest)
        || !isPlainObject(authorization.capability)
    ) {
        return rejected('forged_authorization');
    }

    if (
        !isPlainObject(request.artifact)
        || request.artifact.kind !== expected.artifactKind
        || request.artifact.operation !== expected.operationType
        || request.artifact.layer !== expected.layer
        || (expected.chain !== undefined && request.artifact.chain !== expected.chain)
        || typeof request.artifact.chain !== 'string'
        || typeof request.artifact.network !== 'string'
    ) {
        return rejected('malformed_artifact');
    }

    if (
        authorization.envelope.operationType !== request.artifact.operation
        || authorization.envelope.chain !== request.artifact.chain
        || authorization.envelope.layer !== request.artifact.layer
        || authorization.envelope.network !== request.artifact.network
    ) {
        return rejected('mismatched_authorization');
    }

    let artifactDigest: string;
    try {
        artifactDigest = digestCanonicalPayload(request.artifact as CanonicalValue);
    } catch {
        return rejected('malformed_artifact');
    }

    if (artifactDigest !== authorization.envelope.canonicalOperationDigest) {
        return rejected('artifact_digest_mismatch');
    }

    const inspection = inspectAuthorizedValueOperation(authorization as unknown as AuthorizedValueOperation);
    if (inspection.kind === 'rejected') return rejected(inspection.reason);

    const artifact = Object.freeze({
        kind: 'conxius.wallet.bound-value-artifact.v1' as const,
        canonicalDigest: artifactDigest,
    });
    return Object.freeze({
        kind: 'unsupported' as const,
        reason: 'qualified_adapter_unavailable' as const,
        envelopeDigest: inspection.envelopeDigest,
        artifact,
    });
}
