import { test, expect } from '@playwright/test';

test.describe('DeFi & Swaps', () => {
  test('should show DeFi dashboard with liquidity pools', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Navigate to DeFi
    const defiTab = page.locator('button:has-text("DeFi")');
    if (await defiTab.isVisible()) {
        await defiTab.click();
    }

    // Check for DeFi content
    await expect(page.locator('text=Protocol Liquidity')).toBeVisible();
  });
});
