import {
    createValueOperationGate,
    digestCanonicalPayload,
    digestValueOperationIntent,
    ValueOperationAuthorizationError,
    type AuthorizedValueOperation,
    type CanonicalObject,
    type CanonicalValue,
    type ProtocolKeyCustody,
    type ProviderEvidenceInput,
    type ValueOperationGateOutcome,
    type ValueOperationIntent,
    type ValueOperationReasonCode,
    type ValueOperationStage,
} from './value-operation-gate';

const applicationValueOperationGate = createValueOperationGate();

export interface ValueOperationDisplaySummary {
    readonly title: string;
    readonly action: string;
    readonly amount?: string;
    readonly destination?: string;
    readonly network: string;
    readonly purpose: string;
}

export interface BitcoinPsbtOperationPayload extends CanonicalObject {
    readonly kind: 'bitcoin-psbt';
    readonly psbt: string;
}

export interface ValueOperationAuthorizationRequest {
    readonly intent: ValueOperationIntent;
    readonly summary: ValueOperationDisplaySummary;
    readonly custody: ProtocolKeyCustody;
    readonly evidence: ProviderEvidenceInput;
}

export interface PreparedValueOperationAuthorizationRequest extends ValueOperationAuthorizationRequest {
    readonly intentDigest: string;
}

export type ValueOperationStageOutcome =
    | Readonly<{ kind: 'consumed'; stage: ValueOperationStage; envelopeDigest: string }>
    | Readonly<{ kind: 'rejected'; reason: Extract<ValueOperationReasonCode,
        'expired_authorization' | 'forged_authorization' | 'mismatched_authorization' | 'consumed_authorization'> }>;

export function createDeterministicValueOperationIntent(
    fields: Omit<ValueOperationIntent, 'nonce' | 'challenge'>,
): ValueOperationIntent {
    const operationDigest = digestCanonicalPayload(fields.payload);
    return Object.freeze({
        ...fields,
        nonce: `operation:${operationDigest}`,
        challenge: `confirm:${operationDigest}`,
    });
}

export function prepareValueOperationAuthorization(
    request: ValueOperationAuthorizationRequest,
): PreparedValueOperationAuthorizationRequest {
    const intentDigest = digestValueOperationIntent(request.intent);
    return Object.freeze({ ...request, intentDigest });
}

export function createBitcoinPsbtOperationPayload(psbt: string): BitcoinPsbtOperationPayload {
    const normalized = psbt.trim();
    if (!normalized || /\s/.test(normalized)) throw new Error('Invalid PSBT artifact.');
    return Object.freeze({ kind: 'bitcoin-psbt', psbt: normalized });
}

export function digestBitcoinPsbtOperation(psbt: string): string {
    return digestCanonicalPayload(createBitcoinPsbtOperationPayload(psbt));
}

export async function requestValueOperationAuthorization(
    request: PreparedValueOperationAuthorizationRequest,
    confirmation: 'confirmed' | 'cancelled',
): Promise<ValueOperationGateOutcome> {
    return applicationValueOperationGate.authorize({
        intent: request.intent,
        confirmation: confirmation === 'confirmed'
            ? {
                status: 'confirmed',
                confirmationId: `wallet-ui:${request.intentDigest}`,
                intentDigest: request.intentDigest,
            }
            : { status: 'cancelled' },
        custody: request.custody,
        evidence: request.evidence,
    });
}

export function consumeAuthorizedValueOperationStage(
    authorization: AuthorizedValueOperation,
    stage: ValueOperationStage,
    exactEnvelopeDigest: string,
): ValueOperationStageOutcome {
    try {
        applicationValueOperationGate.assertAndConsumeStage(
            authorization.capability,
            stage,
            exactEnvelopeDigest,
        );
        return Object.freeze({ kind: 'consumed', stage, envelopeDigest: exactEnvelopeDigest });
    } catch (error) {
        if (error instanceof ValueOperationAuthorizationError) {
            return Object.freeze({ kind: 'rejected', reason: error.reason });
        }
        return Object.freeze({ kind: 'rejected', reason: 'forged_authorization' });
    }
}

export function unavailableValueOperationEvidence(reference: string): ProviderEvidenceInput {
    const opaqueEvidence: CanonicalValue = Object.freeze({
        reference,
        status: 'authoritative-provider-not-configured',
    });
    return Object.freeze({ opaqueEvidence });
}

export function redactValueOperationIdentifier(value: string): string {
    const normalized = value.trim();
    if (normalized.length <= 12) return 'redacted';
    return `${normalized.slice(0, 6)}…${normalized.slice(-6)}`;
}

export function valueOperationOutcomeMessage(outcome: ValueOperationGateOutcome): string {
    if (outcome.kind === 'rejected' && outcome.reason === 'user_cancelled') {
        return 'Value operation cancelled.';
    }
    if (outcome.kind === 'unsupported' && outcome.reason === 'unsupported_protocol_key_custody') {
        return 'Native custody is unavailable for this value operation.';
    }
    return 'Value operation unavailable pending authoritative evidence.';
}

export type {
    AuthorizedValueOperation,
    ProtocolKeyCustody,
    ValueOperationGateOutcome,
    ValueOperationIntent,
};
