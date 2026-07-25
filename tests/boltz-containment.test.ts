import { describe, expect, it } from 'vitest';
import { BoltzService } from '../services/boltz';

describe('Boltz execution containment', () => {
    it('exposes no ungated swap-creation or refund-secret API', () => {
        expect('createReverseSwap' in BoltzService).toBe(false);
        expect('createSubmarineSwap' in BoltzService).toBe(false);
    });

    it('retains only read-only deterministic fee estimation', async () => {
        await expect(BoltzService.estimateFees(100_000, 'testnet')).resolves.toEqual({
            boltzFee: 500, minerFee: 5000,
        });
    });
});
