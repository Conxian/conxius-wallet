import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizeAdapterArtifact } from './value-operation-adapter-test-helpers';
import {
    createCoinJoinInputRegistrationArtifact,
    createCoinJoinOutputRegistrationArtifact,
    fetchActiveRounds,
    registerInputs,
    registerOutput,
} from '../services/coinjoin';
import { consumeAuthorizedValueOperationStage } from '../services/value-operations';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
beforeEach(() => fetchMock.mockReset());

const utxo = {
    txid: '11'.repeat(32), vout: 0, amount: 10_000, address: 'tb1qinput', script: '0014', status: 'confirmed',
    isFrozen: false, derivationPath: "m/84'/1'/0'/0/0", privacyRisk: 'Low',
} as const;

describe('CoinJoin value-operation containment', () => {
    it('does not fabricate coordinator rounds', async () => {
        await expect(fetchActiveRounds('testnet')).resolves.toEqual({
            kind: 'unsupported', reason: 'qualified_coordinator_unavailable', rounds: [],
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('gate-binds input and output registration without tokens, credentials, notifications, or stage consumption', async () => {
        const inputArtifact = createCoinJoinInputRegistrationArtifact({
            roundId: 'round-1', utxos: [utxo], changeAddress: 'tb1qchange', network: 'testnet',
            coordinatorConfigurationDigest: '22'.repeat(32),
        });
        const inputAuthorization = await authorizeAdapterArtifact(inputArtifact);
        const inputOutcome = await registerInputs({ authorization: inputAuthorization, artifact: inputArtifact });
        expect(inputOutcome).toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(JSON.stringify(inputOutcome)).not.toMatch(/registration_token|blinded|credential/);
        expect(consumeAuthorizedValueOperationStage(inputAuthorization, 'sign', inputAuthorization.envelopeDigest))
            .toMatchObject({ kind: 'consumed' });

        const outputArtifact = createCoinJoinOutputRegistrationArtifact({
            roundId: 'round-1', registrationToken: 'provider-token', outputAddress: 'tb1qoutput', network: 'testnet',
            credentialCommitments: ['33'.repeat(32)], coordinatorConfigurationDigest: '22'.repeat(32),
        });
        const outputAuthorization = await authorizeAdapterArtifact(outputArtifact);
        await expect(registerOutput({ authorization: outputAuthorization, artifact: outputArtifact }))
            .resolves.toMatchObject({ kind: 'unsupported', reason: 'qualified_adapter_unavailable' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
