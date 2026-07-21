import { expect, type Page } from '@playwright/test';

/**
* The web app intentionally starts in its current sovereign dashboard state.
* Clearing both storage areas before navigation keeps each test independent
* from a previous wallet or bridge session.
*/
export async function resetBrowserState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Reset only the first document in this test. A reload is part of the
    // bridge persistence contract and must retain the fixture set by the test.
    if (!sessionStorage.getItem('__playwright_state_reset')) {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('__playwright_state_reset', '1');
    }
  });
}

export async function waitForWalletShell(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Open Satoshi AI Chat', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('heading', { name: 'Network Activity', exact: true })).toBeVisible({
    timeout: 10_000,
  });
}

export async function openFeature(page: Page, desktopLabel: string, mobileLabel: string): Promise<void> {
  const viewportWidth = page.viewportSize()?.width ?? 1280;

  if (viewportWidth < 768) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const menu = page.locator('div.p-6.pb-32.animate-in');
    const menuItem = menu.getByRole('button', { name: mobileLabel, exact: true });
    await expect(menuItem).toBeVisible();
    await menuItem.click();
    return;
  }

  await page.getByRole('button', { name: desktopLabel, exact: true }).click();
}

/**
* NTTBridge's supported web persistence contract. The component restores a
* pending transfer from these keys on mount; tests use this documented
* fixture instead of inventing a non-existent "in transit" UI state.
*/
export const bridgePersistenceKeys = {
  transaction: 'PENDING_NTT_TX',
  target: 'PENDING_NTT_TARGET',
} as const;
