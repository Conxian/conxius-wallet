import { describe, it, expect, vi, beforeEach } from 'vitest';
import { issueRgbAsset, validateConsignment, createRgbTransfer, Consignment } from '../services/rgb';
import { ValueOperationAuthorizer, ValueOperationRequest } from '../services/value-operation';
import { createAppPrivateValueOperationAuthority } from '../services/app-private/value-operation-authority';

const rejectionAuthority = createAppPrivateValueOperationAuthority('test-vault');
const rejectAuthorization: ValueOperationAuthorizer = Object.assign(
  async (request: ValueOperationRequest) => rejectionAuthority.reject(request),
  { consumer: rejectionAuthority.consumer },
);

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

vi.mock('../services/app-private/value-operation-signer', () => ({
  signAuthorizedValueOperation: vi.fn().mockResolvedValue({
    signature: 'mock_signature_hex',
    pubkey: 'mock_pubkey',
    timestamp: Date.now()
  })
}));

describe('RGB Service', () => {
  it('quarantines RGB issuance before fabricating an asset ID or success', async () => {
    const mockTxid = 'a'.repeat(64);
    await expect(issueRgbAsset('Test Token', 'TST', 1000, 8, 'RGB20', `${mockTxid}:0`))
      .rejects.toThrow('RGB_ASSET_ISSUANCE_QUARANTINED');
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

  it('quarantines RGB transfer instead of returning a pending synthetic anchor', async () => {
    await expect(createRgbTransfer('rgb:asset1', 100, 'blindedutxo1', rejectAuthorization))
      .rejects.toThrow('USER_REJECTED');
  });
});
