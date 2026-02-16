/**
 * Generates a cryptographically secure random alphanumeric string.
 * Replaces insecure Math.random() usage for ID and token generation.
 * Matches the base36 format (0-9, a-z).
 */
export function generateRandomString(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const values = new Uint8Array(length);
    globalThis.crypto.getRandomValues(values);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset[values[i] % charset.length];
    }
    return result;
}
