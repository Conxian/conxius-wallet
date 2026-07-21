import { test, expect } from '@playwright/test';
import { resetBrowserState, waitForWalletShell } from './helpers';

test('AI Security Redaction in Chat UI', async ({ page }) => {
  await resetBrowserState(page);
  await page.goto('/');
  await waitForWalletShell(page);
  await page.getByRole('button', { name: 'Open Satoshi AI Chat', exact: true }).click();

  const addr = ["bc1q", "xy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"].join("");
  const input = page.getByPlaceholder('Ask Satoshi anything...', { exact: true });
  await input.fill('What is the balance of ' + addr + '?');
  await page.keyboard.press('Enter');

  // Verify the redacted placeholder appears in the user message bubble
  await expect(page.getByText(/\[BTC_ADDR_[^\]]+\]/).last()).toBeVisible({ timeout: 10_000 });
  // Verify the actual address is NOT in the DOM
  const content = await page.content();
  expect(content).not.toContain(addr);
});
