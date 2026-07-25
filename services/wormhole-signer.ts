import type { Chain, UnsignedTransaction } from '@wormhole-foundation/sdk';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import { knownUnsupportedValueOperation, type AuthorizedValueOperationExecution, type ValueOperationExecutionOutcome } from './value-operation-result';

export interface WormholeUnsignedTransactionDescriptor extends CanonicalObject {
  readonly transactionDigest: string; readonly chainId: string; readonly nonce: string; readonly route: string;
}
export interface WormholeBatchSigningArtifact extends CanonicalObject {
  readonly kind: 'conxius.wallet.wormhole-batch-signing.v1'; readonly operation: 'sign-wormhole-batch';
  readonly chain: 'wormhole'; readonly layer: 'wormhole'; readonly network: 'mainnet' | 'testnet';
  readonly sourceChain: string; readonly destinationChain: string; readonly signerIdentity: string;
  readonly providerConfigurationDigest: string; readonly batchDigest: string;
  readonly transactions: readonly WormholeUnsignedTransactionDescriptor[];
}
export type WormholeBatchSigningRequest = AuthorizedValueOperationExecution<WormholeBatchSigningArtifact>;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
function required(value: string, field: string): string { const normalized = value.trim(); if (!normalized) throw new Error(`Invalid Wormhole ${field}.`); return normalized; }
function digest(value: string, field: string): string { const normalized = value.toLowerCase(); if (!HEX_DIGEST.test(normalized)) throw new Error(`Invalid Wormhole ${field} digest.`); return normalized; }

export function createWormholeBatchSigningArtifact(fields: {
  network: 'mainnet' | 'testnet'; sourceChain: string; destinationChain: string; signerIdentity: string;
  providerConfigurationDigest: string; transactions: readonly { transactionDigest: string; chainId: string; nonce: string; route: string }[];
}): WormholeBatchSigningArtifact {
  if (fields.transactions.length === 0) throw new Error('Wormhole batch must contain a transaction.');
  const transactions = Object.freeze(fields.transactions.map((transaction) => Object.freeze({
    transactionDigest: digest(transaction.transactionDigest, 'transaction'), chainId: required(transaction.chainId, 'chain ID'),
    nonce: required(transaction.nonce, 'nonce'), route: required(transaction.route, 'route'),
  })));
  return Object.freeze({
    kind: 'conxius.wallet.wormhole-batch-signing.v1', operation: 'sign-wormhole-batch', chain: 'wormhole', layer: 'wormhole',
    network: fields.network, sourceChain: required(fields.sourceChain, 'source chain'), destinationChain: required(fields.destinationChain, 'destination chain'),
    signerIdentity: required(fields.signerIdentity, 'signer identity'), providerConfigurationDigest: digest(fields.providerConfigurationDigest, 'provider configuration'),
    batchDigest: digestCanonicalPayload(transactions), transactions,
  });
}

export async function executeWormholeBatchSigning(request: WormholeBatchSigningRequest): Promise<ValueOperationExecutionOutcome> {
  return knownUnsupportedValueOperation(request, {
    artifactKind: 'conxius.wallet.wormhole-batch-signing.v1', operationType: 'sign-wormhole-batch', layer: 'wormhole', chain: 'wormhole',
  });
}

export class WormholeSigningUnavailableError extends Error {
  readonly code = 'qualified_wormhole_signer_unavailable';
  constructor() { super('A qualified gate-bound Wormhole signer is unavailable.'); this.name = 'WormholeSigningUnavailableError'; }
}

/** Identity-only adapter: no opaque authorization callback and no SDK signing implementation. */
export class ConxiusWormholeSigner {
  constructor(private readonly signerChain: Chain, private readonly signerAddress: string) {}
  chain(): Chain { return this.signerChain; }
  address(): string { return this.signerAddress; }
  async sign(transactions: UnsignedTransaction[]): Promise<never> { void transactions; throw new WormholeSigningUnavailableError(); }
}
