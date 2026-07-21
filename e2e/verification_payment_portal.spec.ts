import { test, expect } from '@playwright/test';
import { openFeature, resetBrowserState, waitForWalletShell } from './helpers';

test('PaymentPortal UI Verification', async ({ page }) => {
  await resetBrowserState(page);
  await page.goto('/');
  await waitForWalletShell(page);
  await openFeature(page, 'Payments', 'Payments');

  // Bitcoin L1 is the current default payment rail.
  await expect(page.getByRole('heading', { name: 'Citadel Pay', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bitcoin L1', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('bc1q... or handle.btc', { exact: true })).toBeVisible();

  // Lightning remains available as the explicit invoice rail.
  await page.getByRole('button', { name: 'Lightning', exact: true }).click();
  await expect(page.getByPlaceholder('Invoice or lnurl...', { exact: true })).toBeVisible();

  // Switching back restores the on-chain address input without stale state.
  await page.getByRole('button', { name: 'Bitcoin L1', exact: true }).click();
  await expect(page.getByPlaceholder('bc1q... or handle.btc', { exact: true })).toBeVisible();
});
