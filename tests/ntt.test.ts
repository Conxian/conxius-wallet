import { describe, it, expect, vi } from 'vitest';

// Mock noble hashes
vi.mock('@noble/hashes/sha2.js', () => ({
    sha256: vi.fn().mockReturnValue(new Uint8Array(32))
}));

// Mock EvmPlatform
vi.mock('@wormhole-foundation/sdk-evm', () => ({
    EvmPlatform: class {}
}));

// Mock Wormhole SDK with static methods
vi.mock('@wormhole-foundation/sdk', async (importOriginal) => {
    const actual = await importOriginal<any>();

    const mockWormholeInstance = {
        getChain: vi.fn().mockImplementation((chain) => ({
            chain,
            address: () => '0xmockaddress'
        })),
        tokenTransfer: vi.fn().mockResolvedValue({
            transfer: { amount: 1000n },
            initiateTransfer: vi.fn().mockResolvedValue(['0xmocktxid'])
        }),
        getTransactionStatus: vi.fn().mockResolvedValue({ state: 'Confirmed', vaa: { signatures: [1, 2, 3] } })
    };

    const MockWormholeClass = vi.fn().mockImplementation(() => mockWormholeInstance);
    // @ts-ignore
    MockWormholeClass.tokenId = vi.fn().mockReturnValue('0xmocktokenid');
    // @ts-ignore
    MockWormholeClass.chainAddress = vi.fn().mockReturnValue('0xmockchainaddress');

    return {
        ...actual,
        Wormhole: MockWormholeClass,
        TokenTransfer: {
            quoteTransfer: vi.fn().mockResolvedValue({ totalFee: 1000n }),
            from: vi.fn().mockResolvedValue({
                fetchAttestation: vi.fn().mockResolvedValue([{ vaa: new Uint8Array([1, 2, 3]) }])
            })
        },
        amount: {
            units: vi.fn().mockReturnValue(1000n),
            parse: vi.fn().mockReturnValue({ amount: 1000n, decimals: 8 })
        },
        wormhole: vi.fn().mockResolvedValue(mockWormholeInstance),
        chainAddress: vi.fn().mockReturnValue('0xmockchainaddress'),
        tokenId: vi.fn().mockReturnValue('0xmocktokenid')
    };
});

// Mock global fetch
global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue([{ symbol: 'W', address: '0x123' }])
});

// Import the service
import { NttService } from '../services/ntt';

describe('NttService Public Integration', () => {
    const mockSigner: any = {
        address: () => '0x123',
        chain: 'Ethereum'
    };

    it('should execute NTT and return a transaction ID', async () => {
        const result = await NttService.executeNtt('1.0', 'Ethereum', 'Base', mockSigner, 'mainnet');
        expect(result).toBe('0xmocktxid');
    });

    it('should estimate fees correctly', async () => {
        const fees = await NttService.estimateFees('1.0', 'Ethereum', 'Base', 'mainnet');
        expect(fees.totalFee).toBeGreaterThan(0);
        expect(fees.integratorFee).toBeDefined();
    });

    it('should track progress using SDK status', async () => {
        const progress = await NttService.trackProgress('0xmocktxid', 'mainnet');
        expect(progress.status).toBe('Confirmed');
        expect(progress.signatures).toBe(3);
    });

    it('should discover public NTT tokens', async () => {
        const tokens = await NttService.discoverPublicNttTokens('mainnet');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].symbol).toBe('W');
    });
});
