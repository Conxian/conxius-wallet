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

  test('should persist bridge state across reload', async ({ page }) => {
    await page.goto('/');
    await waitForWalletShell(page);
    await openFeature(page, 'NTT Bridge', 'Bridge');

    // Use NTTBridge's documented pending-transfer storage fixture. This is the
    // same contract used by the native peg flow after a broadcast.
    await page.evaluate(() => {
      localStorage.setItem('PENDING_NTT_TX', '0xmocktxhash123456789');
      localStorage.setItem('PENDING_NTT_TARGET', 'Stacks');
    });

    await page.reload();
    await waitForWalletShell(page);
    await openFeature(page, 'NTT Bridge', 'Bridge');

    await expect(page.getByRole('heading', { name: 'Transfer Initiated', exact: true })).toBeVisible();
    await expect(page.getByText('0xmocktxhash123456789', { exact: true })).toBeVisible();
    await expect(page.getByText('Monitoring settlement on Stacks...', { exact: true })).toBeVisible();
    await expect(page.evaluate((keys) => localStorage.getItem(keys.transaction), bridgePersistenceKeys)).resolves.toBe(
      '0xmocktxhash123456789',
    );
  });
});
