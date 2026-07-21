import { test, expect } from '@playwright/test';
import { setupMultiWalletMocks } from './multi_wallet_mocks';
import { openFeature, resetBrowserState, waitForWalletShell } from './helpers';

test.describe('Full Wallet System - Strict Functional Audit', () => {
  test.beforeEach(async ({ page }) => {
    await setupMultiWalletMocks(page);
    await resetBrowserState(page);
    await page.goto('/');
    await waitForWalletShell(page);
  });

  test('should audit current wallet surfaces without unbounded polling', async ({ page }) => {
    // Keep this audit bounded for CI while retaining the real navigation,
    // feature-gating, bridge review, and identity/privacy checks.
    test.setTimeout(90_000);

    await expect(page.getByRole('heading', { name: 'Network Activity', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Protocol Sovereignty', exact: true })).toBeVisible();

    await openFeature(page, 'DeFi Hub & Staking', 'DeFi');
    await expect(page.getByRole('heading', { name: 'DeFi Strategy', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Babylon Staking', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Babylon Bitcoin Staking', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'DLC Contracts', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create Offer', exact: true }).first()).toBeVisible();

    await openFeature(page, 'NTT Bridge', 'Bridge');
    await expect(page.getByRole('heading', { name: 'Sovereign Bridge', exact: true })).toBeVisible();
    await page.getByLabel('Source Layer', { exact: true }).selectOption('Liquid');
    await page.getByLabel('Target Layer', { exact: true }).selectOption('BOB');
    await page.getByLabel('Amount to Bridge', { exact: true }).fill('0.1');
    await page.getByRole('button', { name: 'Next: Review Bridge', exact: true }).click();
    await expect(page.getByText('Review Bridge', { exact: true })).toHaveCount(0);
    await expect(page.getByText('0.1 BTC', { exact: true })).toBeVisible();

    await openFeature(page, 'Stacking (PoX)', 'Stacking');
    await expect(page.getByRole('heading', { name: 'Stacking (PoX)', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Yield Performance', exact: true })).toBeVisible();

    await openFeature(page, 'Labs Discovery', 'Labs');
    await expect(page.getByRole('heading', { name: 'ConxianLabs', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Research Terminal', exact: true })).toBeVisible();

    await openFeature(page, 'Identity (D.i.D)', 'Identity');
    await expect(page.getByRole('heading', { name: 'Identity Enclave', exact: true })).toBeVisible();
    await expect(page.getByText(/Web5 Decentralization\./)).toBeVisible();

    await openFeature(page, 'Privacy Enclave', 'Privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Enclave', exact: true })).toBeVisible();
    await expect(page.getByText('Local-Only Key Generation', { exact: true })).toBeVisible();
    await expect(page.getByText('Always Route through Tor', { exact: true })).toBeVisible();

    await openFeature(page, 'Marketplace & Services', 'Bazaar');
    await expect(page.getByRole('heading', { name: 'Sovereign Bazaar', exact: true })).toBeVisible();
    await expect(page.getByText('Marketplace Offline', { exact: true })).toBeVisible();

    await openFeature(page, 'Payments', 'Payments');
    await expect(page.getByRole('heading', { name: 'Citadel Pay', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Lightning', exact: true }).click();
    await expect(page.getByPlaceholder('Invoice or lnurl...', { exact: true })).toBeVisible();

    // The page source must remain free of recovery material throughout the
    // audit, including after visiting feature surfaces.
    const content = await page.content();
    expect(content).not.toMatch(/\b(mnemonic|privateKey|seedPhrase)\b/i);
  });
});
