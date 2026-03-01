import { describe, it, expect, vi } from 'vitest';
import { NttService } from '../services/ntt';

vi.mock('../services/signer', () => ({
    requestEnclaveSignature: vi.fn().mockResolvedValue({
        signature: '616263',
        pubkey: '021234'
    })
}));

describe('NttService Sovereign Signing', () => {
    it('should execute NTT with sovereign signing and return a VAA hash', async () => {
        const signer: any = { address: () => '0x123' };
        const result = await NttService.executeNtt('1.0', 'Ethereum', 'Stacks', signer, 'mainnet');

        expect(result).toBeDefined();
        expect(result).toContain('0xntt');
    });

    it('should use Stacks layer for signing when source is Stacks', async () => {
        const { requestEnclaveSignature } = await import('../services/signer');
        const signer: any = { address: () => '0x123' };

        await NttService.executeNtt('1.0', 'Stacks', 'Ethereum', signer, 'mainnet');

        expect(requestEnclaveSignature).toHaveBeenCalledWith(expect.objectContaining({
            layer: 'Stacks'
        }));
    });
});
