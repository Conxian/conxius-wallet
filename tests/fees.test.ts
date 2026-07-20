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

    const silentPaymentStyleTransaction = {
      ...cleanTransaction(12, 'c'.repeat(64)),
      vin: [{ witness: ['30440220' + '33'.repeat(32), '02' + '44'.repeat(32)] }],
      vout: [{ scriptpubkey: '5120' + '55'.repeat(32) }],
    };
    expect(classifyBitcoinFeeTransaction(silentPaymentStyleTransaction)).toBe('clean');
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
