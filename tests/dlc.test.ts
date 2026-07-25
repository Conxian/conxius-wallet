import { describe, it, expect } from 'vitest';
import { acceptDLCOffer, createDLCOffer, settleDLC, type DLCContract } from '../services/dlc';

describe('DLC Service', () => {
    it('should create a valid DLC offer', () => {
        const outcomes = [
            { label: 'Winner A', payoutSats: 200000 },
            { label: 'Winner B', payoutSats: 0 }
        ];
        const offer = createDLCOffer('oracle_pk', 'event_desc', 100000, outcomes);

        expect(offer.id).toContain('dlc_off_');
        expect(offer.collateralSats).toBe(100000);
        expect(offer.outcomes.length).toBe(2);
    });

    it('quarantines settlement instead of fabricating a CET transaction ID', async () => {
        const offer = createDLCOffer('oracle_pk', 'event_desc', 100000, []);
        const contract: DLCContract = { id: 'contract', status: 'Signed', offer };

        await expect(settleDLC(contract, 'oracle-attestation')).rejects.toThrow('DLC_SETTLEMENT_QUARANTINED');
    });

    it('quarantines offer acceptance before mock signatures or contract success', async () => {
        const offer = createDLCOffer('oracle_pk', 'event_desc', 100000, []);
        await expect(acceptDLCOffer(offer, {} as never)).rejects.toThrow('DLC_ACCEPT_QUARANTINED');
    });
});
