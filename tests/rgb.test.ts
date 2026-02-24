import { describe, it, expect, vi, beforeEach } from 'vitest';
import { issueRgbAsset, validateConsignment, createRgbTransfer, Consignment } from '../services/rgb';

// Mock dependencies
vi.mock('../services/notifications', () => ({
  notificationService: {
    notify: vi.fn(),
    notifyTransaction: vi.fn()
  }
}));

vi.mock('../services/protocol', () => ({
  checkBtcTxStatus: vi.fn().mockResolvedValue({ confirmed: true, blockHeight: 100 })
}));

vi.mock('../services/signer', () => ({
  requestEnclaveSignature: vi.fn().mockResolvedValue({
    signature: 'mock_signature_hex',
    pubkey: 'mock_pubkey',
    timestamp: Date.now()
  })
}));

describe('RGB Service', () => {
  it('should issue an RGB asset correctly', async () => {
    const mockTxid = 'a'.repeat(64);
    const asset = await issueRgbAsset('Test Token', 'TST', 1000, 8, 'RGB20', `${mockTxid}:0`);
    expect(asset.symbol).toBe('TST');
    expect(asset.totalSupply).toBe(1000);
  });

  it('should validate a consignment (CSV)', async () => {
    const consignment: Consignment = {
      id: 'cons:1',
      assetId: 'rgb:123',
      vouts: [0],
      witness: 'valid_witness_hex_64_chars_long_at_least_so_it_passes_structural_check',
      endpoints: ['https://storm.node']
    };

    const isValid = await validateConsignment(consignment);
    expect(isValid).toBe(true);
  });

  it('should fail validation for invalid asset ID', async () => {
    const consignment: Consignment = {
      id: 'cons:2',
      assetId: 'invalid:123',
      vouts: [0],
      witness: 'some_witness',
      endpoints: []
    };

    const isValid = await validateConsignment(consignment);
    expect(isValid).toBe(false);
  });

  it('should create an RGB transfer consignment', async () => {
    const consignment = await createRgbTransfer('rgb:asset1', 100, 'blindedutxo1', 'mockvault');
    expect(consignment.assetId).toBe('rgb:asset1');
    expect(consignment.witness).toBe('mock_signature_hex');
  });
});
