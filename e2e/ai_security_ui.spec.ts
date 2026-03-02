import { test, expect } from '@playwright/test';

test('Satoshi AI Chat UI Transparency & Sanitization', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // 1. Open Chat
  const chatButton = page.locator('button[aria-label="Open Satoshi AI Chat"]');
  await expect(chatButton).toBeVisible();
  await chatButton.click();

  // 2. Verify Header Badge
  const headerBadge = page.locator('span:has-text("Sovereign-Audit-v1.0")');
  await expect(headerBadge).toBeVisible();

  // 3. Verify Mode Indicator (Local-Sim since no API key by default in E2E)
  const modeIndicator = page.locator('span:has-text("Local-Sim")');
  await expect(modeIndicator).toBeVisible();

  // 4. Send a sensitive message and verify sanitization indicator
  const input = page.locator('input[placeholder="Ask Satoshi anything..."]');
  await input.fill('What is the balance of bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh?');
  await page.keyboard.press('Enter');

  // Check for ShieldAlert icon (sanitization indicator)
  const shieldAlert = page.locator('div[title="Sensitive data redacted from outgoing prompt"]');
  await expect(shieldAlert).toBeVisible();

  // Check for the bottom warning message
  const privacyWarning = page.locator('p:has-text("Sensitive identifiers redacted for privacy.")');
  await expect(privacyWarning).toBeVisible();

  await page.screenshot({ path: 'test-results/ai-security-ui.png' });
});
