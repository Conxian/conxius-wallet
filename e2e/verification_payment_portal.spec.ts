import { test, expect } from '@playwright/test';

test('PaymentPortal UI Verification', async ({ page }) => {
  await page.goto('/');
  // Assume we need to login or bypass lock screen if it exists
  if (await page.isVisible('text=Unlock with Passkey')) {
      await page.click('text=Unlock with Passkey');
  }

  // Navigate to Payment Portal if not default
  await page.click('text=Payment');

  // Verify Lightning is default and elements are present
  await expect(page.locator('text=Lightning')).toBeVisible();
  await expect(page.locator('input[placeholder="Invoice or lnurl..."]')).toBeVisible();

  // Screenshot for manual verification
  await page.screenshot({ path: 'payment_portal_lightning.png' });

  // Switch to On-Chain
  await page.click('text=On-Chain');
  await expect(page.locator('input[placeholder="bc1q... or handle.btc"]')).toBeVisible();
  await page.screenshot({ path: 'payment_portal_onchain.png' });
});
