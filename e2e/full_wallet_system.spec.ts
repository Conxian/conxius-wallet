import { test, expect } from '@playwright/test';
import { openFeature, resetBrowserState, waitForWalletShell } from './helpers';

test.describe('Full Wallet System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/address/*/utxo', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { txid: 'f'.repeat(64), vout: 0, value: 100000000, status: { confirmed: true } },
          { txid: 'e'.repeat(64), vout: 1, value: 50000000, status: { confirmed: true } },
        ]),
      });
    });

    await page.route('**/fees/recommended', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fastestFee: 20, halfHourFee: 15, hourFee: 10, economyFee: 5, minimumFee: 1 }),
      });
    });

    await page.route('**/v2/pox', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ current_cycle: { id: 80 }, next_cycle: { min_threshold_ustx: '1000000000' } }),
      });
    });

    await resetBrowserState(page);
    await page.goto('/');
    await waitForWalletShell(page);
  });

  test('should traverse the current wallet surfaces and require signature approval', async ({ page }) => {
    test.setTimeout(60_000);

    await expect(page.getByRole('heading', { name: 'Protocol Sovereignty', exact: true })).toBeVisible();

    await openFeature(page, 'DeFi Hub & Staking', 'DeFi');
    await expect(page.getByRole('heading', { name: 'DeFi Strategy', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Yield & Insurance', exact: true }).click();
    await expect(page.getByText('Protocol Insurance (Parametric)', { exact: true })).toBeVisible();

    await openFeature(page, 'NTT Bridge', 'Bridge');
    await expect(page.getByRole('heading', { name: 'Sovereign Bridge', exact: true })).toBeVisible();
    await page.getByLabel('Amount to Bridge', { exact: true }).fill('0.1');
    await page.getByRole('button', { name: 'Next: Review Bridge', exact: true }).click();
    await expect(page.getByText('Transfer Amount', { exact: true })).toBeVisible();
    await expect(page.getByText('0.1 BTC', { exact: true })).toBeVisible();

    await openFeature(page, 'Stacking (PoX)', 'Stacking');
    await expect(page.getByRole('heading', { name: 'Stacking (PoX)', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Yield Performance', exact: true })).toBeVisible();

    await openFeature(page, 'Labs Discovery', 'Labs');
    await expect(page.getByRole('heading', { name: 'ConxianLabs', exact: true })).toBeVisible();

    await openFeature(page, 'Payments', 'Payments');
    await expect(page.getByRole('heading', { name: 'Citadel Pay', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Lightning', exact: true }).click();
    await expect(page.getByPlaceholder('Invoice or lnurl...', { exact: true })).toBeVisible();

    await openFeature(page, 'Dashboard', 'Wallet');
    await page.getByRole('button', { name: 'Send payment', exact: true }).click();
    await page.getByPlaceholder('Enter Bitcoin Address', { exact: true }).fill('bc1qtestrecipient');
    await page.getByPlaceholder('0.00', { exact: true }).fill('10000');
    await page.getByRole('button', { name: 'Construct PSBT', exact: true }).click();
    await page.getByRole('button', { name: 'Sign Transaction', exact: true }).click();

    // The signing request must be explicitly reviewed before the wallet
    // exposes the broadcast action.
    await expect(page.getByRole('heading', { name: 'Signature Request', exact: true })).toBeVisible();
    await expect(page.getByText('Full Message Payload (WYSIWYS)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Sign', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Broadcast to Mempool', exact: true })).toBeVisible();
  });
});
