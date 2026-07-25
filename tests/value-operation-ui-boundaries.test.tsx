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
    consumeStage: vi.fn(),
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
    payLightningInvoice: vi.fn(), payLnurl: vi.fn(),
}));
vi.mock('../services/value-signer', () => ({ signAuthorizedValueOperationNative: mocks.signValue }));
vi.mock('../services/value-operations', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/value-operations')>();
    return { ...actual, consumeAuthorizedValueOperationStage: mocks.consumeStage };
});
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
        mocks.fetchNativePegAddress.mockResolvedValue('bc1qpegaddress');
        mocks.buildPsbt.mockResolvedValue('70736274ff00');
        mocks.buildSbtcPegInPsbt.mockResolvedValue('70736274ff00');
        mocks.buildNativePegPsbt.mockResolvedValue('70736274ff00');
        mocks.getRecommendedFees.mockResolvedValue({ fastestFee: 2 });
        mocks.estimateFees.mockResolvedValue({ totalFee: 0, integratorFee: 0 });
        mocks.recommendedBridge.mockReturnValue('Native');
        mocks.consumeStage.mockReturnValue({ kind: 'consumed', stage: 'broadcast', envelopeDigest: 'aa'.repeat(32) });
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
        await user.click(screen.getByRole('button', { name: 'Authorize Enclave Sign' }));

        await waitFor(() => expect(authorization).toHaveBeenCalledOnce());
        expect(mocks.signValue).not.toHaveBeenCalled();
        expect(mocks.broadcastTransaction).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalledWith('success', expect.anything());
        expect(screen.queryByText('Payment Sent')).not.toBeInTheDocument();
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

    it('contains no banned production UI fallback literals', () => {
        const dashboard = fs.readFileSync(path.join(process.cwd(), 'components/Dashboard.tsx'), 'utf8');
        const bridge = fs.readFileSync(path.join(process.cwd(), 'components/NTTBridge.tsx'), 'utf8');
        for (const banned of ['mock_hex_abc123', 'dGhpcyBpcyBhIG1vY2sgcHlidA==', 'broadcastBtcTx', '"txid_"']) {
            expect(dashboard).not.toContain(banned);
        }
        expect(bridge).not.toContain('Math.random');
        expect(bridge).not.toContain("setBridgeStatus('COMPLETED')");
    });
});
