import { test, expect } from '@playwright/test';

test('AI Security Redaction in Chat UI', async ({ page }) => {
  await page.goto('/');
  // Assume there is an AI chat button or similar
  await page.click('button:has-text("AI")');

  const addr = ["bc1q", "xy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"].join("");
  const input = page.locator('textarea, input[type="text"]').first();
  await input.fill('What is the balance of ' + addr + '?');
  await page.keyboard.press('Enter');

  // Verify the redacted placeholder appears in the user message bubble
  await expect(page.locator('div:has-text("[BTC_ADDR_")')).toBeVisible();
  // Verify the actual address is NOT in the DOM
  const content = await page.content();
  expect(content).not.toContain(addr);
});
