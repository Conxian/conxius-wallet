const BTC_DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.([0-9]{1,8}))?$/;
const SATOSHI_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const SATOSHIS_PER_BTC = 100_000_000n;
const MAX_SAFE_SATOSHIS = BigInt(Number.MAX_SAFE_INTEGER);

export class BitcoinAmountError extends Error {
    readonly code = 'invalid_bitcoin_amount';

    constructor(message: string) {
        super(message);
        this.name = 'BitcoinAmountError';
    }
}

function assertSafePositiveSatoshis(satoshis: bigint): bigint {
    if (satoshis <= 0n) throw new BitcoinAmountError('Amount must be greater than zero.');
    if (satoshis > MAX_SAFE_SATOSHIS) {
        throw new BitcoinAmountError('Amount exceeds the supported safe integer range.');
    }
    return satoshis;
}

export function parseBtcToSatoshis(value: string): bigint {
    const match = BTC_DECIMAL_PATTERN.exec(value);
    if (!match) {
        throw new BitcoinAmountError('Enter a plain positive BTC amount with at most 8 decimal places.');
    }
    const [wholePart, fractionalPart = ''] = value.split('.');
    const whole = BigInt(wholePart);
    const fraction = BigInt(fractionalPart.padEnd(8, '0') || '0');
    return assertSafePositiveSatoshis((whole * SATOSHIS_PER_BTC) + fraction);
}

export function parseSatoshiAmount(value: string): bigint {
    if (!SATOSHI_PATTERN.test(value)) {
        throw new BitcoinAmountError('Enter a whole positive satoshi amount.');
    }
    return assertSafePositiveSatoshis(BigInt(value));
}

export function toSafeSatoshiNumber(satoshis: bigint): number {
    assertSafePositiveSatoshis(satoshis);
    return Number(satoshis);
}

export function formatSatoshisAsBtc(satoshis: bigint): string {
    const whole = satoshis / SATOSHIS_PER_BTC;
    const fraction = (satoshis % SATOSHIS_PER_BTC).toString().padStart(8, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole.toString();
}
