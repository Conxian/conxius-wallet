import { describe, expect, it } from 'vitest';
import {
    broadcastAuthorizedBitcoinTransaction,
    createBitcoinBroadcastArtifact,
} from '../services/bitcoin-broadcast';

describe('wallet-owned Bitcoin broadcast containment', () => {
    it('checks the exact artifact digest and remains unsupported without network submission', async () => {
        const artifact = createBitcoinBroadcastArtifact('DEADBEEF');
        expect(artifact.transactionHex).toBe('deadbeef');
        await expect(broadcastAuthorizedBitcoinTransaction(artifact)).resolves.toEqual({
            kind: 'unsupported', reason: 'qualified_provider_unavailable',
        });
    });

    it('rejects a transaction swapped beside another artifact digest', async () => {
        const artifactA = createBitcoinBroadcastArtifact('deadbeef');
        const artifactB = { ...artifactA, transactionHex: 'cafebabe' };
        await expect(broadcastAuthorizedBitcoinTransaction(artifactB)).resolves.toEqual({
            kind: 'rejected', reason: 'broadcast_digest_mismatch',
        });
    });

    it('rejects arbitrary txids or malformed transaction artifacts', async () => {
        await expect(broadcastAuthorizedBitcoinTransaction({
            kind: 'bitcoin-transaction', transactionHex: 'not-a-transaction', digest: 'aa'.repeat(32),
        })).resolves.toEqual({ kind: 'rejected', reason: 'invalid_broadcast_artifact' });
    });
});
