import bolt11 from 'light-bolt11-decoder';
import type { Network } from '../types';

export function decodeBolt11(invoice: string) {
  try {
    const decoded: any = bolt11.decode(invoice);
    const amountMsat = decoded.sections?.find((section: any) => section.name === 'amount')?.value || null;
    const networkPrefix = decoded.sections?.find((section: any) => section.name === 'coin_network')?.letters || null;
    return {
      valid: true,
      amountMsat,
      network: networkPrefix === 'bc' ? 'mainnet'
        : networkPrefix === 'tb' ? 'testnet'
        : networkPrefix === 'bcrt' ? 'regtest'
        : null,
      payee: decoded.payeeNodeKey || decoded.payeeNode || null,
      description: decoded.sections?.find((section: any) => section.name === 'description')?.value || null,
      expiry: decoded.expiry || 3600,
      timestamp: decoded.timestamp,
    };
  } catch {
    return { valid: false } as const;
  }
}

export function requireBolt11Settlement(
  invoice: string,
  amountSats: number,
  network: Network,
): { invoice: string; amountSats: number; network: Network } {
  const decoded = decodeBolt11(invoice);
  if (!decoded.valid || !decoded.network) {
    throw new Error('BOLT11_INVALID: invoice could not be decoded with a recognized Bitcoin network');
  }
  if (decoded.network !== network) {
    throw new Error('BOLT11_NETWORK_MISMATCH: invoice network differs from the selected wallet network');
  }
  if (!decoded.amountMsat) {
    throw new Error('BOLT11_AMOUNT_REQUIRED: amountless invoices are quarantined because settlement cannot bind an encoded amount');
  }
  const encodedAmountMsat = Number(decoded.amountMsat);
  if (!Number.isSafeInteger(encodedAmountMsat) || encodedAmountMsat <= 0 || encodedAmountMsat % 1000 !== 0) {
    throw new Error('BOLT11_AMOUNT_INVALID: invoice amount must be a positive whole-satoshi value');
  }
  if (!Number.isSafeInteger(amountSats) || amountSats <= 0 || encodedAmountMsat / 1000 !== amountSats) {
    throw new Error('BOLT11_AMOUNT_MISMATCH: submitted amount differs from the encoded invoice amount');
  }
  return { invoice, amountSats, network };
}
