import { describe, it, expect } from 'vitest';
import { createDLCOffer } from '../services/dlc';

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
});
