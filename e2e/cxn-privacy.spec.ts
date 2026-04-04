import { test, expect } from '@playwright/test';

test.describe('CXN Guardian AI: Privacy Boundary Verification', () => {
    test('should redact sensitive data in simulated DeFi flows', async ({ page }) => {
        await page.goto('/');

        // Bypass onboarding if needed
        if (await page.getByText('Get Started').isVisible()) {
            await page.click('text=Get Started');
            await page.click('text=Create New Wallet');
            await page.click("text=I've backed it up");
        }

        // Navigate to DeFi Enclave
        await page.click('text=DeFi Enclave');
        await page.click('text=Yield & Insurance Discovery');

        // Simulate a scenario where a user might input a sensitive string or an API returns one
        // Since we are in simulation mode, we can verify that the UI components that use
        // the sanitizer are working.

        // This is a placeholder for actual CXN Guardian testing which might involve
        // monitoring network requests or checking redacted labels in the UI.
        // For now, we verify the DeFi dashboard elements are correctly rendered.
        await expect(page.getByText('Lido')).toBeVisible();
        await expect(page.getByText('Protocol Insurance')).toBeVisible();
    });

    test('should ensure marketplace items are correctly displayed', async ({ page }) => {
        await page.goto('/');

        if (await page.getByText('Get Started').isVisible()) {
            await page.click('text=Get Started');
            await page.click('text=Create New Wallet');
            await page.click("text=I've backed it up");
        }

        await page.click('text=Sovereign Bazaar');

        // Check for new integrated services
        await expect(page.getByText('Bitcoin 2024 Ticket')).toBeVisible();
        await expect(page.getByText('Travala Gift Card')).toBeVisible();
        await expect(page.getByText('Global Ghost eSIM')).toBeVisible();
    });
});
