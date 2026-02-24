import { test, expect } from '@playwright/test';

test.describe('Sovereign Bridge Flow', () => {
  test('should render bridge component and handle intent selection', async ({ page }) => {
    await page.goto('/');

    // Wait for app to boot
    await page.waitForTimeout(5000);

    // Navigate to Bridge (if not active tab)
    // Assuming we can click a bottom nav item
    const bridgeTab = page.locator('button:has-text("Bridge")');
    if (await bridgeTab.isVisible()) {
        await bridgeTab.click();
    }

    // Check for Bridge title
    await expect(page.locator('text=Sovereign Bridge')).toBeVisible();

    // Verify intent buttons
    await expect(page.locator('text=BTC DeFi')).toBeVisible();
    await expect(page.locator('text=Sidechain')).toBeVisible();
  });

  test('should persist bridge state across reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Mock localStorage for a pending transaction
    await page.evaluate(() => {
      localStorage.setItem('PENDING_NTT_TX', '0xmocktxhash123456789');
      localStorage.setItem('PENDING_NTT_TARGET', 'Liquid');
    });

    await page.reload();
    await page.waitForTimeout(5000);

    // Should automatically be on step 4 (Transfer in Transit)
    await expect(page.locator('text=Transfer in Transit')).toBeVisible();
    await expect(page.locator('text=0xmocktxhash123456789')).toBeVisible();
  });
});
