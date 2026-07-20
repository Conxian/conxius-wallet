import { test, expect } from '@playwright/test';
import { openFeature, resetBrowserState, waitForWalletShell } from './helpers';

test.describe('CXN Guardian AI: Privacy Boundary Verification', () => {
    test.beforeEach(async ({ page }) => {
        await resetBrowserState(page);
    });

    test('should expose the current local privacy controls', async ({ page }) => {
        await page.goto('/');
        await waitForWalletShell(page);
        await openFeature(page, 'Privacy Enclave', 'Privacy');

        await expect(page.getByRole('heading', { name: 'Privacy Enclave', exact: true })).toBeVisible();
        await expect(page.getByText('Local-Only Key Generation', { exact: true })).toBeVisible();
        await expect(page.getByText('Always Route through Tor', { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Satoshi AI: Privacy Audit', exact: true })).toBeVisible();
    });

    test('should keep the sovereign marketplace gated until its privacy rail is active', async ({ page }) => {
        await page.goto('/');
        await waitForWalletShell(page);
        await openFeature(page, 'Marketplace & Services', 'Bazaar');

        await expect(page.getByRole('heading', { name: 'Sovereign Bazaar', exact: true })).toBeVisible();
        await expect(page.getByText('Marketplace Offline', { exact: true })).toBeVisible();
        await expect(page.getByText(/requires active tor circuit/i)).toBeVisible();
        await expect(page.getByText('Global Ghost eSIM', { exact: true })).toHaveCount(0);
    });
});
