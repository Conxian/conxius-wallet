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

    test('should contain the sovereign marketplace to a non-transactional preview', async ({ page }) => {
        await page.goto('/');
        await waitForWalletShell(page);
        await openFeature(page, 'Marketplace & Services', 'Bazaar');

        await expect(page.getByRole('heading', { name: 'Sovereign Bazaar', exact: true })).toBeVisible();
        await expect(page.getByText('Catalog preview only. Checkout and fulfillment are unavailable.', { exact: true })).toBeVisible();
        await expect(page.getByText('Preview only / No transactions', { exact: true })).toBeVisible();
        await expect(page.getByText('Catalog Preview Unavailable', { exact: true })).toBeVisible();
        await expect(page.getByText('No live marketplace connection, checkout, or fulfillment is available.', { exact: true })).toBeVisible();
        await expect(page.getByText('Global Ghost eSIM', { exact: true })).toHaveCount(0);
        await expect(page.getByText(/Purchase successful|Code delivered|Payment Verified|Redemption Code/i)).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^(Buy|Purchase|Checkout)(\b| )/i })).toHaveCount(0);
    });
});
