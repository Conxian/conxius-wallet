import { describe, it, expect } from 'vitest';
import { liftToArk, forfeitVtxo, syncVtxos } from '../services/ark';

describe('Ark Service', () => {
    it('should lift amount to Ark VTXO', async () => {
        const vtxo = await liftToArk(100000, 'bc1qtest', 'asp:main');
        expect(vtxo.id).toContain('vtxo:');
        expect(vtxo.amount).toBe(100000);
        expect(vtxo.status).toBe('lifting');
    });

    it('should forfeit a VTXO', async () => {
        const success = await forfeitVtxo('vtxo:123', 'bc1qrecipient');
        expect(success).toBe(true);
    });

    it('should sync VTXOs for an address', async () => {
        const vtxos = await syncVtxos('bc1qtest', 'asp:main');
        expect(vtxos.length).toBeGreaterThan(0);
        expect(vtxos[0].status).toBe('available');
    });
});
