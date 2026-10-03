import { stacksAddressNative, stacksSignDigestNative } from './enclave-storage';

export const STACKS_DEFAULT_PATH = "m/44'/5757'/0'/0/0";

/**
 * Native Stacks (sBTC) signing boundary.
 *
 * The private key never crosses into JavaScript. The TS layer owns Stacks
 * transaction serialization and the SIP-018 sighash computation (via
 * @stacks/transactions); native only derives the c32check address and signs a
 * 32-byte SHA512/256 digest, returning the 65-byte `r || s || recoveryId`.
 */

export async function deriveStacksAddress(
  path: string = STACKS_DEFAULT_PATH,
  network = 'mainnet',
): Promise<string> {
  const { address } = await stacksAddressNative({ path, network });
  return address;
}

/**
 * Signs a 32-byte SHA512/256 digest (hex, the SIP-018 signature hash) and
 * returns the `r || s || recoveryId` hex (65 bytes / 130 hex chars). The caller
 * assembles the final Stacks signature from these components.
 */
export async function signStacksDigest(
  digest: string,
  path: string = STACKS_DEFAULT_PATH,
  network = 'mainnet',
): Promise<string> {
  const { signature } = await stacksSignDigestNative({ path, network, digest });
  return signature;
}
