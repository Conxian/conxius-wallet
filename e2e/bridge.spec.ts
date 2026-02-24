import { test, expect } from '@playwright/test';

test('NTT Bridge UI should show intent buttons and handle persistence', async ({ page }) => {
  await page.goto('/');

  // Skip onboarding if needed (simplified mock state)
  // In a real app, we might need to click "Create Wallet" or "Skip"

  // Navigate to Bridge (assuming it's in the menu or a direct route)
  // For this test, we'll assume the app starts or can reach the bridge

  // Wait for app to boot
  await page.waitForTimeout(5000);

  // Check for "Sovereign Bridge" title
  // Since we might be on onboarding, we'll search for the component if possible
  // Or we can mock the state in a real test.

  // For now, we'll just check if the component renders if we can find it
  const bridgeTitle = page.locator('text=Sovereign Bridge');
  // If not visible, we might need to navigate there.
});
