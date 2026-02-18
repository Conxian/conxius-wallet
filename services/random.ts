/**
 * Generates a cryptographically secure random alphanumeric string.
 * Replaces insecure Math.random() usage for ID and token generation.
 * Matches the base36 format (0-9, a-z).
 *
 * Uses rejection sampling to eliminate modulo bias.
 */
export function generateRandomString(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    while (result.length < length) {
        // Request a batch of bytes to minimize crypto calls
        const batchSize = Math.max(length - result.length, 16);
        const values = new Uint8Array(batchSize);
        globalThis.crypto.getRandomValues(values);

        for (let i = 0; i < values.length && result.length < length; i++) {
            const val = values[i];
            // 256 / 36 = 7 remainder 4.
            // 36 * 7 = 252. We discard values 252, 253, 254, 255 to ensure uniformity.
            if (val < 252) {
                result += charset[val % charset.length];
            }
        }
    }
    return result;
}
