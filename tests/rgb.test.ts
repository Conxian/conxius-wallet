import { describe, it, expect, vi } from 'vitest';
import { issueRgbAsset, validateConsignment } from '../services/rgb';

describe('RGB Service', () => {
    it('should issue an RGB asset with valid seal', async () => {
        const asset = await issueRgbAsset(
            'Test Token',
            'TEST',
            1000,
            8,
            'RGB20',
            'a'.repeat(64) + ':0'
        );
        expect(asset.id).toContain('rgb:');
        expect(asset.name).toBe('Test Token');
        expect(asset.symbol).toBe('TEST');
    });

    it('should throw error for invalid seal', async () => {
        await expect(issueRgbAsset(
            'Test Token',
            'TEST',
            1000,
            8,
            'RGB20',
            'invalid-seal'
        )).rejects.toThrow('Invalid Initial Seal format');
    });

    it('should validate a correct consignment', async () => {
        const isValid = await validateConsignment({
            id: 'consignment-1',
            assetId: 'rgb:123',
            vouts: [0],
            witness: '00'.repeat(32)
        });
        expect(isValid).toBe(true);
    });

    it('should fail validation for incorrect asset ID', async () => {
        const isValid = await validateConsignment({
            id: 'consignment-1',
            assetId: 'invalid-id',
            vouts: [0],
            witness: '00'.repeat(32)
        });
        expect(isValid).toBe(false);
    });
});
