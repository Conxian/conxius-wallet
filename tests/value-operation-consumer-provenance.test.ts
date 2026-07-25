import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ValueOperationCapabilityConsumer } from '../services/value-operation-capability-consumer';
import type {
  ValueOperationAuthorizer,
  ValueOperationBroadcastAuthorization,
  ValueOperationSettlementAuthorization,
} from '../services/value-operation';
import {
  assertTrustedValueOperationCapabilityConsumer,
  createAppPrivateValueOperationAuthority,
} from '../services/app-private/value-operation-authority';
import { broadcastAuthorizedTransaction } from '../services/protocol';
import { forfeitVtxo, type VTXO } from '../services/ark';
import { getLightningBackend } from '../services/lightning-backend';
import { signB2bInvoice } from '../services/monetization';
import { createMavenTransfer } from '../services/maven';

const mocks = vi.hoisted(() => ({ fetchWithRetry: vi.fn(), fetch: vi.fn() }));

vi.mock('../services/network', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/network')>();
  return {
    ...original,
    endpointsFor: () => ({
      BTC_API: 'https://bitcoin.example',
      ARK_API: 'https://ark.example',
      MAVEN_API: 'https://maven.example',
    }),
    fetchWithRetry: mocks.fetchWithRetry,
  };
});

const fakeConsumer = {
  isIssuedAuthorization: () => true,
  requireSignature: () => ({ signature: 'forged-signature', pubkey: 'forged-pubkey', timestamp: 0 }),
  requireSettlementAuthorization: () => ({ kind: 'value-operation-settlement-authorization' }),
  consumeBroadcastAuthorization: () => undefined,
  consumeSettlementAuthorization: () => undefined,
} as ValueOperationCapabilityConsumer;

function fakeAuthorizer(): ValueOperationAuthorizer {
  return Object.assign(vi.fn(async () => ({
    status: 'allowed' as const,
    authorization: { kind: 'value-operation-authorization' as const } as never,
    signature: { signature: 'forged-signature', pubkey: 'forged-pubkey', timestamp: 0 },
  })), { consumer: fakeConsumer });
}

describe('runtime value-operation consumer provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mocks.fetch;
  });

  it('rejects a forged broadcast consumer before POSTing transaction bytes', async () => {
    await expect(broadcastAuthorizedTransaction(
      'deadbeef',
      { kind: 'value-operation-broadcast-authorization' } as ValueOperationBroadcastAuthorization,
      'Mainnet',
      'mainnet',
      fakeConsumer,
    )).rejects.toThrow('VALUE_OPERATION_CONSUMER_UNTRUSTED');
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('rejects a fake Ark authorizer/consumer before callback or ASP I/O', async () => {
    const authorize = fakeAuthorizer();
    const vtxo: VTXO = {
      txid: 'deadbeef', vout: 0, amount: 10_000, ownerPubkey: 'owner', serverPubkey: 'server',
      roundTxid: 'round', expiryHeight: 1, status: 'available',
    };
    await expect(forfeitVtxo(vtxo, 'bc1qrecipient', 'mainnet', authorize))
      .rejects.toThrow('VALUE_OPERATION_CONSUMER_UNTRUSTED');
    expect(authorize).not.toHaveBeenCalled();
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('rejects a forged LND consumer before HTTP I/O', async () => {
    const backend = getLightningBackend({ type: 'LND', endpoint: 'https://lnd.example', apiKey: 'macaroon' });
    await expect(backend.payInvoice(
      'lnbc1forged',
      1,
      { kind: 'value-operation-settlement-authorization' } as ValueOperationSettlementAuthorization,
      'mainnet',
      fakeConsumer,
    )).rejects.toThrow('VALUE_OPERATION_CONSUMER_UNTRUSTED');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('rejects forged monetization and Maven authorizers before callback or transport', async () => {
    const monetization = fakeAuthorizer();
    await expect(signB2bInvoice('invoice-1', 50, 'USD', monetization))
      .rejects.toThrow('VALUE_OPERATION_CONSUMER_UNTRUSTED');
    expect(monetization).not.toHaveBeenCalled();

    const maven = fakeAuthorizer();
    await expect(createMavenTransfer('asset', 1, 'recipient', maven))
      .rejects.toThrow('VALUE_OPERATION_CONSUMER_UNTRUSTED');
    expect(maven).not.toHaveBeenCalled();
    expect(mocks.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('accepts genuine consumers while preserving cross-authority rejection', () => {
    const first = createAppPrivateValueOperationAuthority('first');
    const second = createAppPrivateValueOperationAuthority('second');
    expect(() => assertTrustedValueOperationCapabilityConsumer(first.consumer)).not.toThrow();
    expect(() => assertTrustedValueOperationCapabilityConsumer(second.consumer)).not.toThrow();
    expect(() => assertTrustedValueOperationCapabilityConsumer(fakeConsumer)).toThrow('VALUE_OPERATION_CONSUMER_UNTRUSTED');
    expect(() => second.consumer.consumeBroadcastAuthorization(
      { kind: 'value-operation-broadcast-authorization' } as ValueOperationBroadcastAuthorization,
      { signedHex: 'deadbeef', layer: 'Mainnet', network: 'mainnet' },
    )).toThrow('BROADCAST_AUTHORIZATION_INVALID');
  });
});
