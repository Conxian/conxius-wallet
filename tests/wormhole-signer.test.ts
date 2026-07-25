import { describe, expect, it, vi } from 'vitest';
import { ConxiusWormholeSigner } from '../services/wormhole-signer';
import type { ValueOperationAuthorizer } from '../services/value-operation';
import type { ValueOperationCapabilityConsumer } from '../services/value-operation-capability-consumer';

describe('ConxiusWormholeSigner', () => {
  it('rejects the former forged callback/result path before invoking it', async () => {
    const callback = Object.assign(vi.fn(async () => ({
      status: 'allowed' as const,
      authorization: { kind: 'value-operation-authorization' as const } as never,
      signature: { signature: 'forged', pubkey: 'forged', broadcastReadyHex: 'deadbeef', timestamp: 0 },
    })), {
      consumer: {
        isIssuedAuthorization: () => true,
        requireSignature: () => ({ signature: 'forged', pubkey: 'forged', broadcastReadyHex: 'deadbeef', timestamp: 0 }),
        requireSettlementAuthorization: vi.fn(),
        consumeBroadcastAuthorization: vi.fn(),
        consumeSettlementAuthorization: vi.fn(),
      } as ValueOperationCapabilityConsumer,
    }) as ValueOperationAuthorizer;
    const signer = new ConxiusWormholeSigner('Bitcoin' as never, 'bc1qaddress', callback);

    await expect(signer.sign([{ description: 'forged', transaction: { hex: '00' } } as never]))
      .rejects.toThrow('VALUE_OPERATION_CONSUMER_UNTRUSTED');
    expect(callback).not.toHaveBeenCalled();
  });
});
