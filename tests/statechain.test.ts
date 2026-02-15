import { describe, it, expect } from 'vitest';
import { transferStateChainUtxo, syncStateChainUtxos } from '../services/statechain';

describe('StateChain Service', () => {
    it('should transfer a StateChain UTXO', async () => {
        const result = await transferStateChainUtxo('sc:utxo-1', 0, '03newowner');
        expect(result.nextIndex).toBe(1);
        expect(result.signature).toBeDefined();
        expect(typeof result.signature).toBe('string');
    });

    it('should sync StateChain UTXOs', async () => {
        const utxos = await syncStateChainUtxos('bc1qtest');
        expect(utxos.length).toBeGreaterThan(0);
        expect(utxos[0].id).toBe('sc:utxo-99');
    });
});
