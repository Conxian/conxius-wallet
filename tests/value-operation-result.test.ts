import { describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact, forgedAuthorization } from './value-operation-adapter-test-helpers';
import * as resultExports from '../services/value-operation-result';
import { knownUnsupportedValueOperation } from '../services/value-operation-result';
import { consumeAuthorizedValueOperationStage } from '../services/value-operations';

describe('shared value-operation execution contract', () => {
    const expected = {
        artifactKind: 'conxius.wallet.contract-test.v1',
        operationType: 'transfer',
        layer: 'contract-test',
        chain: 'bitcoin',
    } as const;

    it('returns a frozen digest-only unsupported outcome and consumes no stage', async () => {
        const artifact = Object.freeze({
            kind: 'conxius.wallet.contract-test.v1', operation: 'transfer', chain: 'bitcoin', layer: 'contract-test',
            network: 'testnet', amount: '10', recipient: 'test-recipient',
        });
        const authorization = await authorizeAdapterArtifact(artifact);
        const outcome = knownUnsupportedValueOperation({ authorization, artifact }, expected);
        expect(outcome).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(Object.isFrozen(outcome)).toBe(true);
        if (outcome.kind !== 'unsupported') throw new Error('Expected unsupported outcome.');
        expect(Object.isFrozen(outcome.artifact)).toBe(true);
        expect(outcome.artifact).toEqual({
            kind: 'conxius.wallet.bound-value-artifact.v1',
            canonicalDigest: authorization.envelope.canonicalOperationDigest,
        });
        expect(JSON.stringify(outcome)).not.toContain('test-recipient');
        expect(consumeAuthorizedValueOperationStage(authorization, 'sign', authorization.envelopeDigest))
            .toMatchObject({ kind: 'consumed', stage: 'sign' });
    });

    it('rejects forged, malformed, and mismatched artifacts', async () => {
        const artifact = {
            kind: 'conxius.wallet.contract-test.v1', operation: 'transfer', chain: 'bitcoin', layer: 'contract-test',
            network: 'testnet', amount: '10',
        } as const;
        const authorization = await authorizeAdapterArtifact(artifact);
        expect(knownUnsupportedValueOperation({ authorization, artifact: { ...artifact, amount: '11' } }, expected))
            .toMatchObject({ kind: 'rejected', reason: 'artifact_digest_mismatch' });
        expect(knownUnsupportedValueOperation({ authorization: forgedAuthorization(), artifact }, expected))
            .toMatchObject({ kind: 'rejected' });
        expect(knownUnsupportedValueOperation({ authorization, artifact: { ...artifact, unsafe: undefined } as never }, expected))
            .toMatchObject({ kind: 'rejected', reason: 'malformed_artifact' });
    });

    it('rejects an authorization whose envelope semantics do not match the adapter artifact', async () => {
        const artifact = {
            kind: 'conxius.wallet.contract-test.v1', operation: 'transfer', chain: 'bitcoin', layer: 'contract-test',
            network: 'testnet', amount: '10',
        } as const;
        const authorization = await authorizeAdapterArtifact(artifact, { layer: 'wrong-layer' });
        expect(knownUnsupportedValueOperation({ authorization, artifact }, expected))
            .toMatchObject({ kind: 'rejected', reason: 'mismatched_authorization' });
    });

    it('has no success-promotion API and invokes no caller callback', async () => {
        const callback = vi.fn();
        const artifact = {
            kind: 'conxius.wallet.contract-test.v1', operation: 'transfer', chain: 'bitcoin', layer: 'contract-test',
            network: 'testnet', amount: '10',
        } as const;
        const authorization = await authorizeAdapterArtifact(artifact);
        expect(knownUnsupportedValueOperation({ authorization, artifact, callback } as never, expected))
            .toMatchObject({ kind: 'rejected', reason: 'malformed_execution_request' });
        expect(callback).not.toHaveBeenCalled();
        expect(Object.keys(resultExports).filter((name) => /accept|promote|submit|settle|unwrap|success/i.test(name))).toEqual([]);
    });

    it('rejects opaque debug markers and caller status fields as execution authority', async () => {
        const artifact = {
            kind: 'conxius.wallet.contract-test.v1', operation: 'transfer', chain: 'bitcoin', layer: 'contract-test',
            network: 'testnet', amount: '10',
        } as const;
        const authorization = await authorizeAdapterArtifact(artifact);
        const debugEvidence = {
            productionGuard: { kind: 'simulated', value: true },
            androidDebugSimulation: true,
            integrityToken: 'play_integrity_token_debug_stub',
        };
        expect(knownUnsupportedValueOperation({
            authorization, artifact, evidence: debugEvidence, providerStatus: 'verified', settlementStatus: 'settled',
        } as never, expected)).toEqual({ kind: 'rejected', reason: 'malformed_execution_request' });
    });

    it('rejects a capability after its wallet-local expiry without consuming a stage', async () => {
        const artifact = {
            kind: 'conxius.wallet.contract-test.v1', operation: 'transfer', chain: 'bitcoin', layer: 'contract-test',
            network: 'testnet', amount: '10',
        } as const;
        const authorization = await authorizeAdapterArtifact(artifact);
        vi.spyOn(Date, 'now').mockReturnValue(authorization.capability.localExpiresAtMs + 1);
        expect(knownUnsupportedValueOperation({ authorization, artifact }, expected))
            .toMatchObject({ kind: 'rejected', reason: 'expired_authorization' });
    });
});
