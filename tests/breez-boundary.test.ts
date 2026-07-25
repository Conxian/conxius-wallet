import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pay: vi.fn(), sendOnchain: vi.fn(), nodeInfo: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => ({
    pay: mocks.pay, sendOnchain: mocks.sendOnchain, nodeInfo: mocks.nodeInfo,
  })),
}));

import * as breez from '../services/breez';

describe('Breez execution containment', () => {
  it('does not export the raw plugin or ungated payment/send methods', () => {
    expect(breez).not.toHaveProperty('Breez');
    expect(breez).not.toHaveProperty('payLnInvoice');
    expect(breez).not.toHaveProperty('sendBreezOnchain');
    expect(mocks.pay).not.toHaveBeenCalled();
    expect(mocks.sendOnchain).not.toHaveBeenCalled();
  });

  it('keeps read-only discovery separate from payment and send side effects', async () => {
    mocks.nodeInfo.mockResolvedValue({ id: 'node', blockHeight: 1, maxPayableMsat: 0, maxReceivableMsat: 0 });
    await expect(breez.getBreezInfo()).resolves.toMatchObject({ id: 'node' });
    expect(mocks.pay).not.toHaveBeenCalled();
    expect(mocks.sendOnchain).not.toHaveBeenCalled();
  });
});
