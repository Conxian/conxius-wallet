import { test, expect } from '@playwright/test';
import { bridgePersistenceKeys, openFeature, resetBrowserState, waitForWalletShell } from './helpers';

test.describe('Sovereign Bridge Flow', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test('should render bridge component and handle intent selection', async ({ page }) => {
    await page.goto('/');
    await waitForWalletShell(page);
    await openFeature(page, 'NTT Bridge', 'Bridge');

    await expect(page.getByRole('heading', { name: 'Sovereign Bridge', exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'NTT Protocol', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Native Peg-In', exact: true })).toBeVisible();
    await expect(page.getByLabel('Source Layer', { exact: true })).toHaveValue('Mainnet');
    await expect(page.getByLabel('Target Layer', { exact: true })).toHaveValue('Stacks');
  });

  test('should discard legacy pending state and keep NTT execution unavailable', async ({ page }) => {
    await page.goto('/');
    await waitForWalletShell(page);
    await openFeature(page, 'NTT Bridge', 'Bridge');

    // Seed the removed legacy shape to prove an unbound identifier cannot
    // restore synthetic pending, success, or settlement state after reload.
    await page.evaluate(() => {
      localStorage.setItem('PENDING_NTT_TX', '0xmocktxhash123456789');
      localStorage.setItem('PENDING_NTT_TARGET', 'Stacks');
    });

    await page.reload();
    await waitForWalletShell(page);
    await openFeature(page, 'NTT Bridge', 'Bridge');

    await expect(page.getByRole('heading', { name: 'Sovereign Bridge', exact: true })).toBeVisible();
    await expect(page.getByText(/Value-bearing bridge operations require the native enclave path and authoritative evidence/i)).toBeVisible();
    await expect(page.evaluate((keys) => ({
      transaction: localStorage.getItem(keys.transaction),
      target: localStorage.getItem(keys.target),
    }), bridgePersistenceKeys)).resolves.toEqual({ transaction: null, target: null });

    await expect(page.getByText('0xmocktxhash123456789', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Transfer Initiated', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Transfer Completed', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Monitoring settlement on Stacks...', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'NTT Protocol', exact: true }).click();
    await page.getByLabel('Amount to Bridge', { exact: true }).fill('0.001');
    await page.getByRole('button', { name: 'Next: Review Bridge', exact: true }).click();
    await expect(page.getByText('Transfer Amount', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Initiate Sovereign Transfer', exact: true }).click();
    await expect(page.getByText('NTT transfer unavailable: no authoritative execution provider is configured.', { exact: true })).toBeVisible();

    await expect(page.getByText('0xmocktxhash123456789', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Transfer (Initiated|Completed)/i)).toHaveCount(0);
    await expect(page.getByText(/Monitoring settlement/i)).toHaveCount(0);
  });
});
