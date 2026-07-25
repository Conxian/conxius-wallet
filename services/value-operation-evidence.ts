import type { ValueOperationEvidenceAdapter } from './value-operation';

/**
 * Wallet-owned evidence adapter seam. It remains intentionally unwired until
 * an authenticated verifier integration is reviewed and qualified.
 */
export function getWalletEvidenceAdapter(): ValueOperationEvidenceAdapter | null {
  return null;
}
