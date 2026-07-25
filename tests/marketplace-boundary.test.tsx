/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext, initialAppState } from '../context';
import Marketplace from '../components/Marketplace';

describe('Marketplace preview containment', () => {
  it('cannot invoke payment, deliver a code, or render success in simulation mode', async () => {
    const notify = vi.fn();
    render(
      <AppContext.Provider value={{
        state: { ...initialAppState, mode: 'simulation', language: 'en', lnBackend: { type: 'Breez' } },
        notify,
      } as any}>
        <Marketplace />
      </AppContext.Provider>,
    );

    expect(screen.getByText(/Catalog preview only/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Preview Global Ghost eSIM/i }));
    expect(screen.getByText(/Checkout, payment, and code fulfillment are unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/Purchase successful|Payment Verified|Redemption Code|Code delivered/i)).not.toBeInTheDocument();
    expect(notify).not.toHaveBeenCalledWith('success', expect.anything());
  });
});
