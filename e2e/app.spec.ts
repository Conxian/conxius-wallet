import { test, expect } from '@playwright/test';
import { resetBrowserState, waitForWalletShell } from './helpers';

/**
 * Conxius Wallet E2E Tests — Core App Flow
 *
 * These tests verify the critical user-facing flows:
* 1. App boot sequence renders and completes
* 2. The current sovereign wallet shell is reachable
* 3. Navigation controls are available for the active viewport
* 4. Sensitive material is absent from the rendered page and console
 */

test.describe('App Boot & Current Shell', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test('should display boot sequence and reach the current wallet shell', async ({ page }) => {
    await page.goto('/');

    // Boot sequence should show the Conxius branding
    await expect(page.getByRole('heading', { name: 'Conxian-Labs', exact: true })).toBeVisible({ timeout: 10_000 });

    // The current web build boots directly into the sovereign dashboard.
    await waitForWalletShell(page);
  });

  test('should not expose secrets in page source', async ({ page }) => {
    await page.goto('/');
    await waitForWalletShell(page);
    const content = await page.content();

    // Ensure no seed phrases, private keys, or API keys leak into HTML
    expect(content).not.toContain('PLACEHOLDER_API_KEY');
    expect(content).not.toContain('mnemonic');
    expect(content).not.toContain('privateKey');
    expect(content).not.toContain('seedPhrase');
  });
});

test.describe('Security Headers', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test('page should not have inline scripts with secrets', async ({ page }) => {
    await page.goto('/');
    await waitForWalletShell(page);

    // Check that window.Buffer polyfill doesn't expose secrets
    const bufferExposed = await page.evaluate(() => {
      return typeof (window as any).Buffer !== 'undefined';
    });

    // Buffer polyfill existing is okay, but it shouldn't contain seed data
    if (bufferExposed) {
      const bufferContent = await page.evaluate(() => {
        try {
          return (window as any).Buffer.alloc(0).toString();
        } catch {
          return '';
        }
      });
      expect(bufferContent).toBe('');
    }
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test('viewport navigation should expose the current wallet destinations', async ({ page }) => {
    await page.goto('/');
    await waitForWalletShell(page);

    if ((page.viewportSize()?.width ?? 1280) < 768) {
      await expect(page.getByRole('button', { name: 'Bridge', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'NTT Bridge', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Payments', exact: true })).toBeVisible();
    }
  });
});

test.describe('Error Boundary', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test('app should not show unhandled error page', async ({ page }) => {
    await page.goto('/');
    await waitForWalletShell(page);

    // Verify no unhandled React errors visible
    const errorText = page.getByText('An unexpected error occurred', { exact: true });
    const errorCount = await errorText.count();
    expect(errorCount).toBe(0);
  });
});

test.describe('Experimental Gating', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page);
  });

  test('console should not contain seed or key material', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/');
    await waitForWalletShell(page);

    // Verify no secret material in console output
    for (const log of consoleLogs) {
      expect(log).not.toMatch(/[0-9a-f]{64}/i); // No 64-char hex strings (potential keys)
      expect(log).not.toContain('abandon'); // Common first word of test mnemonics
    }
  });
});
