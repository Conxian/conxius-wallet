/** @vitest-environment jsdom */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext, initialAppState } from '../context';
import Dashboard from '../components/Dashboard';
import PaymentPortal from '../components/PaymentPortal';
import NTTBridge from '../components/NTTBridge';

const mocks = vi.hoisted(() => ({
    fetchUtxos: vi.fn(),
    broadcastTransaction: vi.fn(),
    fetchNativePegAddress: vi.fn(),
    buildPsbt: vi.fn(),
    buildSbtcPegInPsbt: vi.fn(),
    buildNativePegPsbt: vi.fn(),
    getRecommendedFees: vi.fn(),
    signValue: vi.fn(),
    broadcastValue: vi.fn(),
    payLightningInvoice: vi.fn(),
    payLnurl: vi.fn(),
    recommendedBridge: vi.fn(),
    estimateFees: vi.fn(),
}));

vi.mock('../components/AssetDetailModal', () => ({ default: () => null }));
vi.mock('../components/UTXOManager', () => ({ default: () => null }));
vi.mock('../components/SilentPayments', () => ({ default: () => null }));
vi.mock('../services/protocol', () => ({
    fetchUtxos: mocks.fetchUtxos,
    broadcastTransaction: mocks.broadcastTransaction,
    fetchNativePegAddress: mocks.fetchNativePegAddress,
    fetchSbtcWalletAddress: vi.fn(),
}));
vi.mock('../services/psbt', () => ({
    buildPsbt: mocks.buildPsbt,
    buildSbtcPegInPsbt: mocks.buildSbtcPegInPsbt,
    buildNativePegPsbt: mocks.buildNativePegPsbt,
}));
vi.mock('../services/fees', () => ({ getRecommendedFees: mocks.getRecommendedFees }));
vi.mock('../services/network', () => ({ endpointsFor: () => ({ BTC_API: 'https://example.invalid' }) }));
vi.mock('../services/lightning', () => ({
    decodeBolt11: vi.fn(), isLnurl: vi.fn(() => false), decodeLnurl: vi.fn(), fetchLnurlParams: vi.fn(),
    payLightningInvoice: mocks.payLightningInvoice, payLnurl: mocks.payLnurl,
}));
vi.mock('../services/value-signer', () => ({ signAuthorizedValueOperationNative: mocks.signValue }));
vi.mock('../services/bitcoin-broadcast', () => ({
    broadcastAuthorizedBitcoinTransaction: mocks.broadcastValue,
}));
vi.mock('../services/ntt', () => ({
    NttService: { estimateFees: mocks.estimateFees },
    BRIDGE_STAGES: [],
    NTT_CONFIGS: {},
    getRecommendedBridgeProtocol: mocks.recommendedBridge,
}));

function renderWithContext(component: React.ReactElement, authorization: ReturnType<typeof vi.fn>, notify = vi.fn()) {
    const value = {
        state: {
            ...initialAppState,
            language: 'en',
            assets: [],
            walletConfig: { masterAddress: 'bc1qwallet', stacksAddress: 'SPWALLET' },
        },
        requestValueOperationAuthorization: authorization,
        notify,
    } as any;
    return { ...render(<AppContext.Provider value={value}>{component}</AppContext.Provider>), notify };
}

describe('value UI fail-closed boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mocks.fetchUtxos.mockResolvedValue([]);
        mocks.fetchNativePegAddress.mockResolvedValue({
            kind: 'available', address: 'bc1qpegaddress', source: 'qualified-provider',
        });
        mocks.buildPsbt.mockResolvedValue('70736274ff00');
        mocks.buildSbtcPegInPsbt.mockResolvedValue('70736274ff00');
        mocks.buildNativePegPsbt.mockResolvedValue('70736274ff00');
        mocks.getRecommendedFees.mockResolvedValue({ fastestFee: 2 });
        mocks.estimateFees.mockResolvedValue({ totalFee: 0, integratorFee: 0 });
        mocks.recommendedBridge.mockReturnValue('Native');
        mocks.signValue.mockResolvedValue({ kind: 'unsupported', reason: 'non_native_platform' });
        mocks.broadcastValue.mockResolvedValue({ kind: 'unsupported', reason: 'qualified_provider_unavailable' });
    });

    it('Dashboard reports unavailable and never exposes synthetic signed/broadcast success after rejection', async () => {
        const authorization = vi.fn().mockResolvedValue({ kind: 'unsupported', reason: 'unsupported_provider' });
        const { notify } = renderWithContext(<Dashboard />, authorization);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Send payment' }));
        await user.type(screen.getByPlaceholderText('Enter Bitcoin Address'), 'bc1qdestination');
        await user.type(screen.getByPlaceholderText('0.00'), '1250');
        await user.click(screen.getByRole('button', { name: 'Review Transfer' }));
        await user.click(screen.getByRole('button', { name: 'Sign Transaction' }));

        await waitFor(() => expect(authorization).toHaveBeenCalledOnce());
        expect(notify).toHaveBeenCalledWith('error', expect.stringContaining('unavailable'));
        expect(notify).not.toHaveBeenCalledWith('success', expect.anything());
        expect(screen.queryByText(/Signed & Ready|Broadcast to Mempool/i)).not.toBeInTheDocument();
    });

    it('PaymentPortal does not sign, broadcast, or report success after authorization rejection', async () => {
        const authorization = vi.fn().mockResolvedValue({ kind: 'rejected', reason: 'user_cancelled' });
        const { notify } = renderWithContext(<PaymentPortal />, authorization);
        const user = userEvent.setup();

        await user.type(screen.getByPlaceholderText('bc1q... or handle.btc'), 'bc1qdestination');
        await user.type(screen.getByPlaceholderText('0.00'), '0.0001');
        await user.click(screen.getByRole('button', { name: 'Review Payment Authorization' }));

        await waitFor(() => expect(authorization).toHaveBeenCalledOnce());
        expect(authorization.mock.calls[0][0].intent.payload).toEqual({
            kind: 'bitcoin-psbt', psbt: '70736274ff00',
        });
        expect(mocks.signValue).not.toHaveBeenCalled();
        expect(mocks.broadcastTransaction).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalledWith('success', expect.anything());
        expect(screen.queryByText('Payment Sent')).not.toBeInTheDocument();
    });

    it('never submits a signed Bitcoin artifact or reports settlement without a qualified receipt', async () => {
        const exactAuthorization = {
            kind: 'authorized',
            envelope: { canonicalOperationDigest: '11'.repeat(32) },
            envelopeDigest: 'aa'.repeat(32),
            capability: { envelopeDigest: 'aa'.repeat(32) },
        };
        const authorization = vi.fn().mockResolvedValue(exactAuthorization);
        const exactSigned = Object.freeze({
            kind: 'signed-bitcoin-value-operation', transactionHex: 'deadbeef',
            transactionDigest: 'bb'.repeat(32), network: 'mainnet',
        });
        mocks.signValue.mockResolvedValueOnce({ kind: 'signed', signed: exactSigned });
        const { notify } = renderWithContext(<PaymentPortal />, authorization);
        const user = userEvent.setup();

        await user.type(screen.getByPlaceholderText('bc1q... or handle.btc'), 'bc1qdestination');
        await user.type(screen.getByPlaceholderText('0.00'), '0.0001');
        await user.click(screen.getByRole('button', { name: 'Review Payment Authorization' }));

        await waitFor(() => expect(notify).toHaveBeenCalledWith('error', expect.stringContaining('broadcast unavailable')));
        expect(mocks.broadcastValue).toHaveBeenCalledWith({ authorization: exactAuthorization, signed: exactSigned });
        expect(mocks.broadcastTransaction).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalledWith('success', expect.anything());
    });

    it('queues deterministic Lightning intent but never calls Lightning execution functions', async () => {
        const authorization = vi.fn().mockResolvedValue({ kind: 'authorized' });
        const { notify } = renderWithContext(<PaymentPortal />, authorization);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Lightning' }));
        await user.type(screen.getByPlaceholderText('Invoice or lnurl...'), 'lnbc1testinvoice');
        await user.type(screen.getByPlaceholderText('0.00'), '1250');
        await user.click(screen.getByRole('button', { name: 'Review Payment Authorization' }));

        await waitFor(() => expect(authorization).toHaveBeenCalledOnce());
        expect(authorization.mock.calls[0][0].intent).toMatchObject({
            operationType: 'lightning-payment',
            layer: 'lightning',
            purpose: 'payment-portal-lightning',
            audience: 'qualified-lightning-adapter',
            payload: { kind: 'lightning-payment', requestKind: 'bolt11', amountSats: '1250' },
        });
        expect(authorization.mock.calls[0][0].intent.payload.requestDigest).toMatch(/^[0-9a-f]{64}$/);
        expect(mocks.payLightningInvoice).not.toHaveBeenCalled();
        expect(mocks.payLnurl).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith('error', expect.stringContaining('Lightning execution unavailable'));
        expect(notify).not.toHaveBeenCalledWith('success', expect.anything());
    });

    it('native peg-in does not sign, broadcast, or complete after unsupported authorization', async () => {
        const authorization = vi.fn().mockResolvedValue({ kind: 'unsupported', reason: 'unsupported_provider' });
        const { notify } = renderWithContext(<NTTBridge />, authorization);
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Amount to Bridge'), '0.001');
        await user.click(screen.getByRole('button', { name: /Next: Review Bridge/i }));
        await user.click(screen.getByRole('button', { name: /Initiate Sovereign Transfer/i }));

        await waitFor(() => expect(authorization).toHaveBeenCalledOnce());
        expect(mocks.signValue).not.toHaveBeenCalled();
        expect(mocks.broadcastTransaction).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalledWith('success', expect.anything());
        expect(screen.queryByText('Transfer Broadcast')).not.toBeInTheDocument();
    });

    it('native peg-in stops before PSBT construction when no qualified peg address is available', async () => {
        mocks.fetchNativePegAddress.mockResolvedValueOnce({
            kind: 'unsupported', reason: 'qualified_peg_address_provider_unavailable', layer: 'Stacks', network: 'mainnet',
        });
        const authorization = vi.fn();
        const { notify } = renderWithContext(<NTTBridge />, authorization);
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Amount to Bridge'), '0.001');
        await user.click(screen.getByRole('button', { name: /Next: Review Bridge/i }));
        await user.click(screen.getByRole('button', { name: /Initiate Sovereign Transfer/i }));

        await waitFor(() => expect(notify).toHaveBeenCalledWith('error', expect.stringContaining('peg address provider')));
        expect(mocks.buildSbtcPegInPsbt).not.toHaveBeenCalled();
        expect(mocks.buildNativePegPsbt).not.toHaveBeenCalled();
        expect(authorization).not.toHaveBeenCalled();
        expect(mocks.signValue).not.toHaveBeenCalled();
    });

    it('native peg-in preserves exact authorization and signed artifact but never reports submission', async () => {
        const exactAuthorization = {
            kind: 'authorized', envelope: { canonicalOperationDigest: '11'.repeat(32) },
            envelopeDigest: 'aa'.repeat(32), capability: { envelopeDigest: 'aa'.repeat(32) },
        };
        const exactSigned = Object.freeze({
            kind: 'signed-bitcoin-value-operation', transactionHex: 'deadbeef',
            transactionDigest: 'bb'.repeat(32), network: 'mainnet',
        });
        const authorization = vi.fn().mockResolvedValue(exactAuthorization);
        mocks.signValue.mockResolvedValueOnce({ kind: 'signed', signed: exactSigned });
        const { notify } = renderWithContext(<NTTBridge />, authorization);
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Amount to Bridge'), '0.001');
        await user.click(screen.getByRole('button', { name: /Next: Review Bridge/i }));
        await user.click(screen.getByRole('button', { name: /Initiate Sovereign Transfer/i }));

        await waitFor(() => expect(notify).toHaveBeenCalledWith('error', expect.stringContaining('broadcast unavailable')));
        expect(mocks.broadcastValue).toHaveBeenCalledWith({ authorization: exactAuthorization, signed: exactSigned });
        expect(notify).not.toHaveBeenCalledWith('success', expect.anything());
        expect(screen.queryByText('Transfer Broadcast')).not.toBeInTheDocument();
    });

    it('NTT simulation remains explicitly unsupported with no completion identifier', async () => {
        mocks.recommendedBridge.mockReturnValue('NTT');
        const authorization = vi.fn();
        const { notify } = renderWithContext(<NTTBridge />, authorization);
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Amount to Bridge'), '0.001');
        await user.click(screen.getByRole('button', { name: /Next: Review Bridge/i }));
        await user.click(screen.getByRole('button', { name: /Initiate Sovereign Transfer/i }));

        expect(authorization).not.toHaveBeenCalled();
        expect(mocks.broadcastTransaction).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith('error', expect.stringContaining('unavailable'));
        expect(screen.queryByText('Transfer Broadcast')).not.toBeInTheDocument();
    });

    it('clears legacy bare NTT txids without restoring a terminal state', async () => {
        localStorage.setItem('PENDING_NTT_TX', 'ab'.repeat(32));
        localStorage.setItem('PENDING_NTT_TARGET', 'Stacks');

        renderWithContext(<NTTBridge />, vi.fn());

        await waitFor(() => expect(localStorage.getItem('PENDING_NTT_TX')).toBeNull());
        expect(localStorage.getItem('PENDING_NTT_TARGET')).toBeNull();
        expect(screen.queryByText('Transfer Broadcast')).not.toBeInTheDocument();
    });

    it('contains no banned production UI fallback literals', () => {
        const dashboard = fs.readFileSync(path.join(process.cwd(), 'components/Dashboard.tsx'), 'utf8');
        const bridge = fs.readFileSync(path.join(process.cwd(), 'components/NTTBridge.tsx'), 'utf8');
        for (const banned of ['mock_hex_abc123', 'dGhpcyBpcyBhIG1vY2sgcHlidA==', 'broadcastBtcTx', '"txid_"']) {
            expect(dashboard).not.toContain(banned);
        }
        expect(bridge).not.toContain('Math.random');
        expect(bridge).not.toContain("setBridgeStatus('COMPLETED')");
        expect(bridge).not.toContain('broadcastTransaction');
        expect(bridge).not.toContain('Transfer Broadcast');
        const payment = fs.readFileSync(path.join(process.cwd(), 'components/PaymentPortal.tsx'), 'utf8');
        expect(payment).not.toContain('broadcastTransaction');
        expect(payment).not.toContain('payLightningInvoice');
        expect(payment).not.toContain('payLnurl');
        expect(payment).not.toContain('Payment Sent');
        expect(payment).not.toContain('createBitcoinBroadcastArtifact');
        expect(bridge).not.toContain('createBitcoinBroadcastArtifact');
    });
});
