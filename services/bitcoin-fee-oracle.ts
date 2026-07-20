import { fetchWithRetry, withAbortDeadline } from './network';

export type FeeRecommendation = {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
};

export type FeeTransactionClassification = 'clean' | 'inscription' | 'invalid';

export type BitcoinFeeSample = {
  feeRate: number;
  blockHeight: number;
  transactionId?: string;
};

export type BitcoinFeeOracleRequestOptions = Pick<RequestInit, 'signal'>;

export interface BitcoinFeeOracleTransport {
  getJson<T>(url: string, options?: BitcoinFeeOracleRequestOptions): Promise<T>;
}

export interface BitcoinFeeOracleProvider {
  getRecentBlocks(baseUrl: string, limit: number, signal?: AbortSignal): Promise<unknown>;
  getBlockTransactions(baseUrl: string, blockHash: string, startIndex: number, signal?: AbortSignal): Promise<unknown>;
}

export interface CleanBlockFeeOptions {
  provider?: BitcoinFeeOracleProvider;
  transport?: BitcoinFeeOracleTransport;
  signal?: AbortSignal;
  cleanOracleTimeoutMs?: number;
  maxBlocks?: number;
  maxTransactionsPerBlock?: number;
  maxTotalTransactions?: number;
  maxPagesPerBlock?: number;
  minCleanSamples?: number;
}

export const BITCOIN_FEE_ORACLE_LIMITS = {
  maxBlocks: 6,
  maxTransactionsPerBlock: 64,
  maxTotalTransactions: 256,
  maxPagesPerBlock: 3,
  pageSize: 25,
  maxPageRecords: 64,
  maxInputsPerTransaction: 128,
  maxOutputsPerTransaction: 128,
  maxWitnessItemsPerInput: 32,
  maxWitnessItemBytes: 4096,
  maxScriptBytes: 4096,
  maxVsize: 10_000_000,
  cleanOracleTimeoutMs: 5_000,
  maxCleanOracleTimeoutMs: 15_000,
  legacyFallbackTimeoutMs: 5_000,
  maxLegacyFallbackTimeoutMs: 15_000,
  maxFeeRateSatPerVbyte: 1_000_000,
  minCleanSamples: 12,
} as const;

const CLEAN_FEE_TARGETS = {
  fastestFee: 0.9,
  halfHourFee: 0.6,
  hourFee: 0.35,
} as const;

const defaultTransport: BitcoinFeeOracleTransport = {
  async getJson<T>(url: string, options: BitcoinFeeOracleRequestOptions = {}): Promise<T> {
    const response = await fetchWithRetry(url, options);
    if (!response.ok) {
      throw new Error('fee oracle request failed');
    }
    return await response.json() as T;
  },
};

export const defaultBitcoinFeeOracleTransport = defaultTransport;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value as number));
}

function normalizeOptions(options: CleanBlockFeeOptions): Required<Pick<
  CleanBlockFeeOptions,
  'cleanOracleTimeoutMs' | 'maxBlocks' | 'maxTransactionsPerBlock' | 'maxTotalTransactions' | 'maxPagesPerBlock' | 'minCleanSamples'
>> {
  return {
    cleanOracleTimeoutMs: boundedInteger(
      options.cleanOracleTimeoutMs,
      BITCOIN_FEE_ORACLE_LIMITS.cleanOracleTimeoutMs,
      1,
      BITCOIN_FEE_ORACLE_LIMITS.maxCleanOracleTimeoutMs,
    ),
    maxBlocks: boundedInteger(options.maxBlocks, BITCOIN_FEE_ORACLE_LIMITS.maxBlocks, 1, BITCOIN_FEE_ORACLE_LIMITS.maxBlocks),
    maxTransactionsPerBlock: boundedInteger(
      options.maxTransactionsPerBlock,
      BITCOIN_FEE_ORACLE_LIMITS.maxTransactionsPerBlock,
      1,
      BITCOIN_FEE_ORACLE_LIMITS.maxTransactionsPerBlock,
    ),
    maxTotalTransactions: boundedInteger(
      options.maxTotalTransactions,
      BITCOIN_FEE_ORACLE_LIMITS.maxTotalTransactions,
      1,
      BITCOIN_FEE_ORACLE_LIMITS.maxTotalTransactions,
    ),
    maxPagesPerBlock: boundedInteger(options.maxPagesPerBlock, BITCOIN_FEE_ORACLE_LIMITS.maxPagesPerBlock, 1, BITCOIN_FEE_ORACLE_LIMITS.maxPagesPerBlock),
    minCleanSamples: boundedInteger(options.minCleanSamples, BITCOIN_FEE_ORACLE_LIMITS.minCleanSamples, 1, BITCOIN_FEE_ORACLE_LIMITS.maxTotalTransactions),
  };
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

export function createBitcoinFeeOracleProvider(
  transport: BitcoinFeeOracleTransport = defaultBitcoinFeeOracleTransport,
): BitcoinFeeOracleProvider {
  return {
    getRecentBlocks: (baseUrl, limit, signal) => transport.getJson(
      endpoint(baseUrl, `/blocks?limit=${limit}`),
      { signal },
    ),
    getBlockTransactions: (baseUrl, blockHash, startIndex, signal) => (
      transport.getJson(endpoint(baseUrl, `/block/${blockHash}/txs/${startIndex}`), { signal })
    ),
  };
}

function decodeHex(value: unknown, maxBytes: number): Uint8Array | null {
  if (typeof value !== 'string' || value.length % 2 !== 0 || value.length > maxBytes * 2 || !/^[0-9a-f]*$/i.test(value)) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

type PushResult = {
  start: number;
  end: number;
  next: number;
};

function readPush(bytes: Uint8Array, index: number): PushResult | null {
  if (index >= bytes.length) return null;

  const opcode = bytes[index];
  if (opcode === 0x00) {
    return { start: index + 1, end: index + 1, next: index + 1 };
  }

  let length: number;
  let next = index + 1;
  if (opcode >= 0x01 && opcode <= 0x4b) {
    length = opcode;
  } else if (opcode === 0x4c) {
    if (next >= bytes.length) return null;
    length = bytes[next];
    next += 1;
  } else if (opcode === 0x4d) {
    if (next + 1 >= bytes.length) return null;
    length = bytes[next] | (bytes[next + 1] << 8);
    next += 2;
  } else if (opcode === 0x4e) {
    if (next + 3 >= bytes.length) return null;
    length = bytes[next]
      | (bytes[next + 1] << 8)
      | (bytes[next + 2] << 16)
      | (bytes[next + 3] << 24);
    next += 4;
    if (length < 0) return null;
  } else {
    return null;
  }

  const end = next + length;
  if (end > bytes.length) return null;
  return { start: next, end, next: end };
}

function matchesOrd(bytes: Uint8Array, push: PushResult): boolean {
  return push.end - push.start === 3
    && bytes[push.start] === 0x6f
    && bytes[push.start + 1] === 0x72
    && bytes[push.start + 2] === 0x64;
}

function parseInscriptionEnvelope(value: unknown, maxBytes: number): 'match' | 'no-match' | 'malformed' {
  const bytes = decodeHex(value, maxBytes);
  if (!bytes) return 'malformed';
  if (bytes.length < 6 || bytes[0] !== 0x00 || bytes[1] !== 0x63) return 'no-match';

  const ordPush = readPush(bytes, 2);
  if (!ordPush) return 'malformed';
  if (!matchesOrd(bytes, ordPush)) return 'no-match';

  let sawBodySeparator = false;
  let index = ordPush.next;
  while (index < bytes.length) {
    const opcode = bytes[index];
    if (opcode === 0x68) {
      return sawBodySeparator ? 'match' : 'no-match';
    }
    if (opcode === 0x00) {
      sawBodySeparator = true;
      index += 1;
      continue;
    }
    if ((opcode >= 0x01 && opcode <= 0x4b) || opcode === 0x4c || opcode === 0x4d || opcode === 0x4e) {
      const push = readPush(bytes, index);
      if (!push) return 'malformed';
      index = push.next;
      continue;
    }
    index += 1;
  }

  return 'malformed';
}

function inspectScript(value: unknown, maxBytes: number): 'match' | 'no-match' | 'malformed' {
  if (value === undefined) return 'no-match';
  return parseInscriptionEnvelope(value, maxBytes);
}

/**
* Classifies only transaction input script data. Taproot output/input shape by
* itself is not an inscription signal; a bounded `OP_FALSE OP_IF "ord" ...
* OP_ENDIF` envelope is required.
*/
export function classifyBitcoinFeeTransaction(value: unknown): FeeTransactionClassification {
  if (!isRecord(value)) return 'invalid';

  const inputs = value.vin;
  const outputs = value.vout;
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > BITCOIN_FEE_ORACLE_LIMITS.maxInputsPerTransaction) {
    return 'invalid';
  }
  if (!Array.isArray(outputs) || outputs.length === 0 || outputs.length > BITCOIN_FEE_ORACLE_LIMITS.maxOutputsPerTransaction) {
    return 'invalid';
  }

  if (isRecord(value.status) && value.status.confirmed === false) return 'invalid';

  let foundInscription = false;
  for (const input of inputs) {
    if (!isRecord(input)) return 'invalid';
    if (typeof input.coinbase === 'string') return 'invalid';

    const witness = input.witness;
    if (witness !== undefined) {
      if (!Array.isArray(witness) || witness.length > BITCOIN_FEE_ORACLE_LIMITS.maxWitnessItemsPerInput) {
        return 'invalid';
      }
      for (const item of witness) {
        const result = inspectScript(item, BITCOIN_FEE_ORACLE_LIMITS.maxWitnessItemBytes);
        if (result === 'malformed') return 'invalid';
        if (result === 'match') foundInscription = true;
      }
    }

    const scriptSig = input.scriptsig ?? input.scriptSig;
    const result = inspectScript(scriptSig, BITCOIN_FEE_ORACLE_LIMITS.maxScriptBytes);
    if (result === 'malformed') return 'invalid';
    if (result === 'match') foundInscription = true;
  }

  return foundInscription ? 'inscription' : 'clean';
}

function parseFeeRate(value: unknown): number | null {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return null;
  return value as number;
}

function parseVsize(value: unknown): number | null {
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > BITCOIN_FEE_ORACLE_LIMITS.maxVsize) {
    return null;
  }
  return value as number;
}

function parseWeight(value: unknown): number | null {
  const maxWeight = BITCOIN_FEE_ORACLE_LIMITS.maxVsize * 4;
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > maxWeight) {
    return null;
  }
  return value as number;
}

function feeRateForTransaction(value: unknown): number | null {
  if (!isRecord(value)) return null;
  const fee = parseFeeRate(value.fee);
  if (fee === null) return null;

  const vsize = parseVsize(value.vsize)
    ?? (parseWeight(value.weight) !== null ? Math.ceil((value.weight as number) / 4) : null);
  if (vsize === null) return null;

  const feeRate = fee / vsize;
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > BITCOIN_FEE_ORACLE_LIMITS.maxFeeRateSatPerVbyte) {
    return null;
  }
  return feeRate;
}

function blockRecord(value: unknown): { id: string; height: number; txCount: number } | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || !/^[0-9a-f]{64}$/i.test(value.id)) return null;
  if (!Number.isSafeInteger(value.height) || (value.height as number) < 0) return null;
  if (!Number.isSafeInteger(value.tx_count) || (value.tx_count as number) <= 0) return null;
  return { id: value.id, height: value.height as number, txCount: value.tx_count as number };
}

function transactionId(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.txid !== 'string') return undefined;
  return /^[0-9a-f]{64}$/i.test(value.txid) ? value.txid : undefined;
}

function samplePageStarts(txCount: number, maxTransactionsPerBlock: number, maxPagesPerBlock: number): number[] {
  const pageSize = BITCOIN_FEE_ORACLE_LIMITS.pageSize;
  const maxPages = Math.min(maxPagesPerBlock, Math.max(1, Math.ceil(maxTransactionsPerBlock / pageSize)));
  const starts: number[] = [];

  if (txCount <= maxTransactionsPerBlock) {
    for (let start = 0; start < txCount && starts.length < maxPages; start += pageSize) {
      starts.push(start);
    }
    return starts;
  }

  const pageCount = Math.ceil(txCount / pageSize);
  const middlePage = Math.floor((pageCount - 1) / 2);
  const candidatePages = [0, middlePage, pageCount - 1];
  for (const page of candidatePages) {
    const startIndex = page * pageSize;
    if (startIndex < txCount && !starts.includes(startIndex) && starts.length < maxPages) {
      starts.push(startIndex);
    }
  }
  return starts.sort((left, right) => left - right);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error('operation aborted');
}

async function collectCleanBlockFeeSamples(
  baseUrl: string,
  options: CleanBlockFeeOptions,
): Promise<BitcoinFeeSample[]> {
  const limits = normalizeOptions(options);
  const provider = options.provider ?? createBitcoinFeeOracleProvider(options.transport ?? defaultBitcoinFeeOracleTransport);
  throwIfAborted(options.signal);
  const rawBlocks = await provider.getRecentBlocks(baseUrl, limits.maxBlocks, options.signal);
  throwIfAborted(options.signal);
  if (!Array.isArray(rawBlocks)) return [];

  const samples: BitcoinFeeSample[] = [];
  let scannedRecords = 0;
  for (const rawBlock of rawBlocks.slice(0, limits.maxBlocks)) {
    throwIfAborted(options.signal);
    if (scannedRecords >= limits.maxTotalTransactions) break;
    const block = blockRecord(rawBlock);
    if (!block) continue;

    const seenTransactions = new Set<string>();
    let scannedBlockRecords = 0;
    for (const startIndex of samplePageStarts(block.txCount, limits.maxTransactionsPerBlock, limits.maxPagesPerBlock)) {
      throwIfAborted(options.signal);
      if (scannedRecords >= limits.maxTotalTransactions || scannedBlockRecords >= limits.maxTransactionsPerBlock) break;
      const rawPage = await provider.getBlockTransactions(baseUrl, block.id, startIndex, options.signal);
      throwIfAborted(options.signal);
      if (!Array.isArray(rawPage)) continue;

      const page = rawPage.slice(0, Math.min(
        rawPage.length,
        BITCOIN_FEE_ORACLE_LIMITS.maxPageRecords,
        limits.maxTransactionsPerBlock - scannedBlockRecords,
      ));
      for (const transaction of page) {
        throwIfAborted(options.signal);
        if (scannedRecords >= limits.maxTotalTransactions) break;
        scannedRecords += 1;
        scannedBlockRecords += 1;

        const txid = transactionId(transaction);
        if (txid && seenTransactions.has(txid)) continue;
        if (txid) seenTransactions.add(txid);

        if (classifyBitcoinFeeTransaction(transaction) !== 'clean') continue;
        const feeRate = feeRateForTransaction(transaction);
        if (feeRate === null) continue;

        samples.push({ feeRate, blockHeight: block.height, transactionId: txid });
        if (samples.length >= limits.maxTotalTransactions) break;
      }
    }
  }

  return samples;
}

function nearestRank(sortedRates: readonly number[], percentile: number): number {
  const rank = Math.max(1, Math.ceil(sortedRates.length * percentile));
  return sortedRates[Math.min(sortedRates.length, rank) - 1];
}

/**
* Estimates target fee rates from clean, confirmed-block samples. The model is
* deliberately deterministic: nearest-rank percentiles at 90%, 60%, and 35%.
*/
export function estimateCleanBlockFees(
  samples: readonly BitcoinFeeSample[],
  minCleanSamples: number = BITCOIN_FEE_ORACLE_LIMITS.minCleanSamples,
): FeeRecommendation | null {
  const minimum = boundedInteger(minCleanSamples, BITCOIN_FEE_ORACLE_LIMITS.minCleanSamples, 1, BITCOIN_FEE_ORACLE_LIMITS.maxTotalTransactions);
  const rates = samples
    .map(sample => sample.feeRate)
    .filter(rate => Number.isFinite(rate) && rate >= 0 && rate <= BITCOIN_FEE_ORACLE_LIMITS.maxFeeRateSatPerVbyte)
    .sort((left, right) => left - right);

  if (rates.length < minimum) return null;
  return {
    fastestFee: Math.max(1, Math.ceil(nearestRank(rates, CLEAN_FEE_TARGETS.fastestFee))),
    halfHourFee: Math.max(1, Math.ceil(nearestRank(rates, CLEAN_FEE_TARGETS.halfHourFee))),
    hourFee: Math.max(1, Math.ceil(nearestRank(rates, CLEAN_FEE_TARGETS.hourFee))),
  };
}

export async function getCleanBlockFeeRecommendation(
  baseUrl: string,
  options: CleanBlockFeeOptions = {},
): Promise<FeeRecommendation | null> {
  try {
    const limits = normalizeOptions(options);
    const samples = await withAbortDeadline(
      signal => collectCleanBlockFeeSamples(baseUrl, { ...options, signal }),
      options.signal,
      limits.cleanOracleTimeoutMs,
    );
    return estimateCleanBlockFees(samples, limits.minCleanSamples);
  } catch {
    return null;
  }
}
