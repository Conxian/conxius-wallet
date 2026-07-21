import { test, expect } from '@playwright/test';
import { openFeature, resetBrowserState, waitForWalletShell } from './helpers';

test.describe('DeFi & Swaps', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test('should show DeFi dashboard with liquidity pools', async ({ page }) => {
    await page.goto('/');
    await waitForWalletShell(page);
    await openFeature(page, 'DeFi Hub & Staking', 'DeFi');

    await expect(page.getByRole('heading', { name: 'DeFi Strategy', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sovereign Zap', exact: true })).toBeVisible();
    const unavailable = page.getByRole('button', { name: 'Swap Unavailable', exact: true });
    await expect(unavailable).toBeVisible();
    await expect(unavailable).toBeDisabled();
  });
});
