import { describe, expect, it, vi } from 'vitest';
import {
  BITCOIN_FEE_ORACLE_LIMITS,
  classifyBitcoinFeeTransaction,
  estimateCleanBlockFees,
  getCleanBlockFeeRecommendation,
  type BitcoinFeeOracleProvider,
  type BitcoinFeeOracleTransport,
} from '../services/bitcoin-fee-oracle';
import { getRecommendedFees } from '../services/fees';

const blockHash = 'a'.repeat(64);

function cleanTransaction(feeRate: number, txid = `${feeRate}`.padStart(64, '0')) {
  return {
    txid,
    fee: feeRate * 100,
    vsize: 100,
    vin: [{ witness: ['30440220' + '11'.repeat(32)] }],
    vout: [{ scriptpubkey: '0014' + '22'.repeat(20) }],
    status: { confirmed: true },
  };
}

function inscriptionTransaction() {
  return {
    ...cleanTransaction(1000, 'b'.repeat(64)),
    vin: [{ witness: ['0063036f72640101000068'] }],
  };
}

function silentPaymentStyleTransaction() {
  return {
    version: 2,
    locktime: 850000,
    txid: 'c'.repeat(64),
    fee: 1200,
    vsize: 142,
    vin: [{
      txid: 'd'.repeat(64),
      vout: 1,
      sequence: 0xfffffffd,
      prevout: {
        value: 25_000,
        scriptpubkey: '0014' + '11'.repeat(20),
        scriptpubkey_type: 'v0_p2wpkh',
      },
      witness: ['aa'.repeat(64)],
    }],
    vout: [
      {
        value: 12_000,
        scriptpubkey: '5120' + '22'.repeat(32),
        scriptpubkey_type: 'v1_p2tr',
      },
      {
        value: 11_800,
        scriptpubkey: '0014' + '33'.repeat(20),
        scriptpubkey_type: 'v0_p2wpkh',
      },
    ],
    status: { confirmed: true, block_height: 850000 },
  };
}

function providerFor(transactions: unknown[]): BitcoinFeeOracleProvider {
  return {
    getRecentBlocks: vi.fn(async () => [{ id: blockHash, height: 850000, tx_count: transactions.length }]),
    getBlockTransactions: vi.fn(async () => transactions),
  };
}

describe('Bitcoin clean-block fee oracle', () => {
  it('includes clean confirmed samples and produces deterministic target estimates', async () => {
    const transactions = Array.from({ length: 12 }, (_, index) => cleanTransaction(index + 2));
    const result = await getCleanBlockFeeRecommendation('https://mempool.example/api', {
      provider: providerFor(transactions),
      maxBlocks: 1,
      minCleanSamples: 12,
    });

    expect(result).toEqual({ fastestFee: 12, halfHourFee: 9, hourFee: 6 });
  });

  it('excludes narrow inscription envelopes without treating all Taproot transactions as data', () => {
    expect(classifyBitcoinFeeTransaction(inscriptionTransaction())).toBe('inscription');
    expect(classifyBitcoinFeeTransaction(silentPaymentStyleTransaction())).toBe('clean');
  });

  it('skips malformed and oversized records while retaining bounded clean samples', async () => {
    const malformed = {
      ...cleanTransaction(500, 'd'.repeat(64)),
      vin: [{ witness: ['not-hex'] }],
    };
    const oversized = {
      ...cleanTransaction(600, 'e'.repeat(64)),
      vin: [{ witness: ['00'.repeat(BITCOIN_FEE_ORACLE_LIMITS.maxScriptBytes + 1)] }],
    };
    expect(classifyBitcoinFeeTransaction(malformed)).toBe('invalid');
    expect(classifyBitcoinFeeTransaction(oversized)).toBe('invalid');

    const cleanSamples = [cleanTransaction(5), cleanTransaction(6), cleanTransaction(7)];
    const result = await getCleanBlockFeeRecommendation('https://mempool.example/api', {
      provider: providerFor([...cleanSamples, malformed, oversized]),
      maxBlocks: 1,
      minCleanSamples: 3,
    });

    expect(result).toEqual({ fastestFee: 7, halfHourFee: 6, hourFee: 6 });
  });

  it('uses the legacy endpoint when clean samples are insufficient or fetching fails', async () => {
    const endpointRecommendation = { fastestFee: 21, halfHourFee: 13, hourFee: 8 };
    const transportCalls: string[] = [];
    const transport: BitcoinFeeOracleTransport = {
      async getJson<T>(url: string): Promise<T> {
        transportCalls.push(url);
        if (url.endsWith('/v1/fees/recommended')) return endpointRecommendation as T;
        throw new Error('unexpected test request');
      },
    };

    const insufficient = await getRecommendedFees('https://mempool.example/api', {
      provider: providerFor([cleanTransaction(4)]),
      transport,
      maxBlocks: 1,
      minCleanSamples: 3,
    });
    expect(insufficient).toEqual(endpointRecommendation);

    const failingProvider: BitcoinFeeOracleProvider = {
      getRecentBlocks: vi.fn(async () => { throw new Error('network unavailable'); }),
      getBlockTransactions: vi.fn(),
    };
    const failedFetch = await getRecommendedFees('https://mempool.example/api', {
      provider: failingProvider,
      transport,
      maxBlocks: 1,
      minCleanSamples: 3,
    });
    expect(failedFetch).toEqual(endpointRecommendation);
    expect(transportCalls).toContain('https://mempool.example/api/v1/fees/recommended');
  });

  it('composes exact Esplora endpoints and uses bounded page offsets', async () => {
    const calls: Array<{ url: string; signal?: AbortSignal }> = [];
    const transport: BitcoinFeeOracleTransport = {
      async getJson<T>(url: string, options: { signal?: AbortSignal } = {}): Promise<T> {
        calls.push({ url, signal: options.signal });
        if (url === 'https://mempool.example/api/blocks?limit=1') {
          return [{ id: blockHash, height: 850000, tx_count: 64 }] as T;
        }

        const startIndex = Number(url.substring(url.lastIndexOf('/') + 1));
        const pageLength = startIndex === 50 ? 14 : 25;
        return Array.from({ length: pageLength }, (_, index) => (
          cleanTransaction(startIndex + index + 1, `${(startIndex + index + 1).toString(16)}`.padStart(64, '0'))
        )) as T;
      },
    };

    await expect(getCleanBlockFeeRecommendation('https://mempool.example/api/', {
      transport,
      maxBlocks: 1,
      maxTransactionsPerBlock: 64,
      maxPagesPerBlock: 3,
      maxTotalTransactions: 64,
      minCleanSamples: 12,
    })).resolves.not.toBeNull();

    expect(calls.map(call => call.url)).toEqual([
      'https://mempool.example/api/blocks?limit=1',
      `https://mempool.example/api/block/${blockHash}/txs/0`,
      `https://mempool.example/api/block/${blockHash}/txs/25`,
      `https://mempool.example/api/block/${blockHash}/txs/50`,
    ]);
    expect(calls.every(call => call.signal)).toBe(true);
  });

  it('enforces block, per-block page, and global record bounds', async () => {
    const firstBlock = '1'.repeat(64);
    const secondBlock = '2'.repeat(64);
    const thirdBlock = '3'.repeat(64);
    const pageCalls: Array<{ blockHash: string; startIndex: number }> = [];
    const provider: BitcoinFeeOracleProvider = {
      getRecentBlocks: vi.fn(async (_baseUrl, limit) => [
        { id: firstBlock, height: 850002, tx_count: 100 },
        { id: secondBlock, height: 850001, tx_count: 100 },
        { id: thirdBlock, height: 850000, tx_count: 100 },
      ].slice(0, limit)),
      getBlockTransactions: vi.fn(async (_baseUrl, currentBlock, startIndex) => {
        pageCalls.push({ blockHash: currentBlock, startIndex });
        return Array.from({ length: 25 }, (_, index) => (
          cleanTransaction(
            index + 1,
            `${currentBlock.slice(0, 2)}${(startIndex + index).toString(16).padStart(4, '0')}`.padEnd(64, '0'),
          )
        ));
      }),
    };

    await expect(getCleanBlockFeeRecommendation('https://mempool.example/api', {
      provider,
      maxBlocks: 2,
      maxTransactionsPerBlock: 30,
      maxPagesPerBlock: 2,
      maxTotalTransactions: 35,
      minCleanSamples: 35,
    })).resolves.not.toBeNull();

    expect(pageCalls).toEqual([
      { blockHash: firstBlock, startIndex: 0 },
      { blockHash: firstBlock, startIndex: 25 },
      { blockHash: secondBlock, startIndex: 0 },
    ]);
    expect(pageCalls.some(call => call.blockHash === thirdBlock)).toBe(false);
  });

  it('does not count duplicate transaction IDs as distinct clean samples', async () => {
    const duplicate = cleanTransaction(2, 'f'.repeat(64));
    const provider = providerFor([
      duplicate,
      duplicate,
      cleanTransaction(10, '0'.repeat(63) + '1'),
    ]);

    await expect(getCleanBlockFeeRecommendation('https://mempool.example/api', {
      provider,
      maxBlocks: 1,
      maxTransactionsPerBlock: 3,
      minCleanSamples: 3,
    })).resolves.toBeNull();
  });

  it('requires vsize or derives virtual size from weight, never raw size alone', async () => {
    const sizeOnly = { ...cleanTransaction(100, 'a'.repeat(64)), vsize: undefined, size: 100 };
    const weighted = { ...cleanTransaction(4, 'b'.repeat(64)), vsize: undefined, weight: 401 };
    const result = await getCleanBlockFeeRecommendation('https://mempool.example/api', {
      provider: providerFor([sizeOnly, weighted]),
      maxBlocks: 1,
      minCleanSamples: 1,
    });

    expect(result).toEqual({ fastestFee: 4, halfHourFee: 4, hourFee: 4 });
  });

  it('bounds aggregate clean sampling and falls back to legacy fees', async () => {
    vi.useFakeTimers();
    try {
      const endpointRecommendation = { fastestFee: 21, halfHourFee: 13, hourFee: 8 };
      const transportCalls: Array<{ url: string; signal?: AbortSignal }> = [];
      const transport: BitcoinFeeOracleTransport = {
        async getJson<T>(url: string, options: { signal?: AbortSignal } = {}): Promise<T> {
          transportCalls.push({ url, signal: options.signal });
          return endpointRecommendation as T;
        },
      };
      const provider: BitcoinFeeOracleProvider = {
        getRecentBlocks: vi.fn(() => new Promise<unknown[]>(() => {})),
        getBlockTransactions: vi.fn(),
      };

      const resultPromise = getRecommendedFees('https://mempool.example/api', {
        provider,
        transport,
        cleanOracleTimeoutMs: 25,
        legacyFallbackTimeoutMs: 25,
        minCleanSamples: 1,
      });

      await vi.advanceTimersByTimeAsync(24);
      expect(transportCalls).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      await expect(resultPromise).resolves.toEqual(endpointRecommendation);

      expect(transportCalls).toEqual([
        {
          url: 'https://mempool.example/api/v1/fees/recommended',
          signal: expect.any(AbortSignal),
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns the fixed fallback when the injected legacy transport ignores its deadline', async () => {
    vi.useFakeTimers();
    try {
      const transportCalls: Array<{ url: string; signal?: AbortSignal }> = [];
      const transport: BitcoinFeeOracleTransport = {
        async getJson<T>(url: string, options: { signal?: AbortSignal } = {}): Promise<T> {
          transportCalls.push({ url, signal: options.signal });
          return new Promise<T>(() => {});
        },
      };
      const provider = providerFor([]);
      const resultPromise = getRecommendedFees('https://mempool.example/api', {
        provider,
        transport,
        cleanOracleTimeoutMs: 25,
        legacyFallbackTimeoutMs: 25,
        minCleanSamples: 1,
      });

      await vi.advanceTimersByTimeAsync(24);
      expect(transportCalls).toHaveLength(1);
      expect(resultPromise).toBeInstanceOf(Promise);
      await vi.advanceTimersByTimeAsync(1);
      await expect(resultPromise).resolves.toEqual({ fastestFee: 15, halfHourFee: 8, hourFee: 5 });
      expect(transportCalls[0].signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns the fixed fallback when both clean data and the legacy endpoint fail', async () => {
    const transport: BitcoinFeeOracleTransport = {
      getJson: vi.fn(async () => { throw new Error('endpoint unavailable'); }),
    };
    const result = await getRecommendedFees('https://mempool.example/api', {
      provider: {
        getRecentBlocks: vi.fn(async () => { throw new Error('block source unavailable'); }),
        getBlockTransactions: vi.fn(),
      },
      transport,
      maxBlocks: 1,
      minCleanSamples: 3,
    });

    expect(result).toEqual({ fastestFee: 15, halfHourFee: 8, hourFee: 5 });
  });

  it('keeps percentile estimates stable for fractional sample rates', () => {
    const result = estimateCleanBlockFees([
      { feeRate: 1.01, blockHeight: 1 },
      { feeRate: 1.99, blockHeight: 1 },
      { feeRate: 2.01, blockHeight: 1 },
      { feeRate: 2.99, blockHeight: 1 },
    ], 4);

    expect(result).toEqual({ fastestFee: 3, halfHourFee: 3, hourFee: 2 });
  });
});
