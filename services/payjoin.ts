import { parseBip21 } from './bip21';
import type { Network } from '../types';
import { digestCanonicalPayload, type CanonicalObject } from './value-operation-gate';
import {
  knownUnsupportedValueOperation,
  type AuthorizedValueOperationExecution,
  type ValueOperationExecutionOutcome,
} from './value-operation-result';

export interface PayJoinOutput extends CanonicalObject {
  readonly scriptOrAddress: string;
  readonly amountSats: string;
  readonly role: 'recipient' | 'change' | 'refund' | 'other';
}

export interface PayJoinArtifact extends CanonicalObject {
  readonly kind: 'conxius.wallet.payjoin.v1';
  readonly operation: 'execute-payjoin';
  readonly chain: 'bitcoin';
  readonly layer: 'payjoin';
  readonly network: Network;
  readonly endpointIdentityDigest: string;
  readonly originalPsbtDigest: string;
  readonly proposedPsbtDigest: string;
  readonly outputsDigest: string;
  readonly amountSats: string;
  readonly maximumFeeContributionSats: string;
  readonly maximumFeeRateSatPerVbyte: string;
  readonly recipient: string;
  readonly refundDestination: string;
}

export type PayJoinExecutionRequest = AuthorizedValueOperationExecution<PayJoinArtifact>;

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Invalid PayJoin ${field}.`);
  return normalized;
}

function canonicalUnsigned(value: number | string, field: string): string {
  const normalized = typeof value === 'number' ? String(value) : value;
  if (!/^(0|[1-9][0-9]*)$/.test(normalized)) throw new Error(`Invalid PayJoin ${field}.`);
  const numeric = Number(normalized);
  if (!Number.isSafeInteger(numeric) || numeric < 0) throw new Error(`Invalid PayJoin ${field}.`);
  return normalized;
}

function digestArtifact(kind: string, value: string): string {
  const normalized = required(value, kind);
  if (/\s/.test(normalized)) throw new Error(`Invalid PayJoin ${kind}.`);
  return digestCanonicalPayload(Object.freeze({ kind, value: normalized }));
}

function endpointIdentity(endpoint: string): string {
  const url = new URL(required(endpoint, 'endpoint'));
  if (url.protocol !== 'https:') throw new Error('Invalid PayJoin endpoint protocol.');
  url.hash = '';
  return url.toString();
}

/** Canonical binding exported so a retrieved proposal cannot later be swapped before execution. */
export function createPayJoinArtifact(fields: {
  originalPsbt: string;
  proposedPsbt: string;
  network: Network;
  endpoint: string;
  outputs: readonly { scriptOrAddress: string; amountSats: number | string; role: PayJoinOutput['role'] }[];
  amountSats: number | string;
  maximumFeeContributionSats: number | string;
  maximumFeeRateSatPerVbyte: number | string;
  recipient: string;
  refundDestination: string;
}): PayJoinArtifact {
  if (fields.outputs.length === 0) throw new Error('Invalid PayJoin outputs.');
  const outputs = Object.freeze(fields.outputs.map((output) => Object.freeze({
    scriptOrAddress: required(output.scriptOrAddress, 'output'),
    amountSats: canonicalUnsigned(output.amountSats, 'output amount'),
    role: output.role,
  })));
  return Object.freeze({
    kind: 'conxius.wallet.payjoin.v1', operation: 'execute-payjoin', chain: 'bitcoin', layer: 'payjoin',
    network: fields.network,
    endpointIdentityDigest: digestCanonicalPayload(Object.freeze({
      kind: 'conxius.wallet.payjoin-endpoint.v1', endpoint: endpointIdentity(fields.endpoint),
    })),
    originalPsbtDigest: digestArtifact('conxius.wallet.payjoin-original-psbt.v1', fields.originalPsbt),
    proposedPsbtDigest: digestArtifact('conxius.wallet.payjoin-proposed-psbt.v1', fields.proposedPsbt),
    outputsDigest: digestCanonicalPayload(outputs), amountSats: canonicalUnsigned(fields.amountSats, 'amount'),
    maximumFeeContributionSats: canonicalUnsigned(fields.maximumFeeContributionSats, 'maximum fee contribution'),
    maximumFeeRateSatPerVbyte: canonicalUnsigned(fields.maximumFeeRateSatPerVbyte, 'maximum fee rate'),
    recipient: required(fields.recipient, 'recipient'), refundDestination: required(fields.refundDestination, 'refund destination'),
  });
}

export class PayJoinService {
  constructor(private readonly network: Network = 'mainnet') {}

  hasPayJoin(uri: string): boolean {
    const parsed = parseBip21(uri);
    return !!parsed.options?.pj;
  }

  getNetwork(): Network {
    return this.network;
  }

  /** No proposal fetch, signing callback, broadcast, storage, or local txid derivation occurs. */
  async sendPayJoin(request: PayJoinExecutionRequest): Promise<ValueOperationExecutionOutcome> {
    return knownUnsupportedValueOperation(request, {
      artifactKind: 'conxius.wallet.payjoin.v1', operationType: 'execute-payjoin', layer: 'payjoin', chain: 'bitcoin',
    });
  }
}
