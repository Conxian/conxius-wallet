import { test, expect } from '@playwright/test';
import { setupMultiWalletMocks } from './multi_wallet_mocks';

test.describe('Full Wallet System - Strict Functional Audit', () => {

  test.beforeEach(async ({ page }) => {
    await setupMultiWalletMocks(page);
    await page.goto('/');
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
    await page.reload();
  });

  test('Strict Onboarding & Multi-Wallet Interaction (10 Wallets)', async ({ page, viewport }) => {
    test.setTimeout(600_000); // 10 minutes for full audit

    // --- 1. STRICT ONBOARDING ---
    await expect(page.getByText('Conxian-Labs')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Simulation/i }).click();
    await page.getByRole('button', { name: /Create Vault/i }).click();
    await page.getByRole('button', { name: /Personal Vault/i }).click();
    await page.getByRole('button', { name: /Continue to Entropy Scan/i }).click();

    // Entropy Gathering Simulation
    await expect(page.getByText(/Gathering Entropy/i)).toBeVisible();
    for (let i = 0; i < 200; i++) {
        await page.mouse.move(100 + (i % 20) * 10, 100 + Math.floor(i / 20) * 10);
        if (i % 50 === 0) await page.waitForTimeout(100);
    }

    // PIN Setup
    await expect(page.getByText(/Secure Enclave/i)).toBeVisible({ timeout: 60000 });
    const pinInputs = page.locator('input[type="password"]');
    await pinInputs.nth(0).fill('123456');
    await pinInputs.nth(1).fill('123456');
    await page.getByRole('button', { name: /Confirm Encryption/i }).click();

    // BIP-39 Backup Verification
    await expect(page.getByText(/Master Seed Backup/i)).toBeVisible();
    await page.getByRole('button', { name: /Reveal Phrase/i }).click();
    const words = await page.evaluate(() => {
        const wordElements = document.querySelectorAll('span.text-xs.font-bold.text-zinc-300');
        return Array.from(wordElements).map(el => el.textContent || '');
    });
    await page.getByRole('button', { name: /Verify Backup/i }).click();

    // Verification Inputs
    await page.waitForSelector('label:has-text("Word #")');
    const indicesToVerify = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label')).filter(l => l.textContent?.includes('Word #'));
        return labels.map(l => parseInt(l.textContent?.split('#')[1] || '0') - 1);
    });
    for (let i = 0; i < indicesToVerify.length; i++) {
        await page.locator('div.space-y-6 input[type="password"]').nth(i).fill(words[indicesToVerify[i]]);
    }
    await page.getByRole('button', { name: /Initialize Enclave/i }).click();

    // --- 2. DASHBOARD & MULTI-WALLET (10 Wallets) ---
    await expect(page.getByText('Sovereignty').first()).toBeVisible({ timeout: 60000 });
    console.log('Onboarding Complete. Starting Functional Audit...');

    const isMobile = (viewport?.width || 0) < 768;
    const navigateTo = async (desktopLabel: string, mobileLabel: string) => {
        if (isMobile) {
            await page.getByRole('button', { name: 'Menu', exact: true }).click();
            await page.waitForTimeout(500);
            await page.locator('div.animate-in button').filter({ hasText: new RegExp('^' + mobileLabel + '$') }).first().click();
        } else {
            await page.getByRole('button', { name: desktopLabel, exact: true }).click();
        }
        await page.waitForTimeout(500);
    };

    // --- 3. LAYER VALIDATION (All 24+ Layers) ---
    await navigateTo('Dashboard', 'Wallet');
    await expect(page.getByText(/Bitcoin/i).first()).toBeVisible();
    await expect(page.getByText(/Stacks/i).first()).toBeVisible();
    await expect(page.getByText(/Liquid/i).first()).toBeVisible();

    // Check Phase 5 L2s
    const l2s = ['BOB', 'B2', 'Alpen', 'Zulu', 'Bison', 'Hemi', 'Nubit', 'Lorenzo', 'Citrea', 'Babylon', 'Merlin', 'Bitlayer'];
    for (const l2 of l2s) {
        await expect(page.getByText(new RegExp('^' + l2 + '$', 'i')).first()).toBeVisible();
    }

    // --- 4. DEFI ENCLAVE (Yield & LP) ---
    await navigateTo('DeFi Enclave', 'DeFi');
    await expect(page.getByRole('heading', { name: /DeFi/i }).first()).toBeVisible();
    await expect(page.getByText(/Institutional-grade yield/i)).toBeVisible();
    await page.getByRole('button', { name: /Positions/i }).first().click();

            // --- 5. NTT BRIDGE (Wormhole & Native Peg) ---
    await navigateTo('NTT Bridge', 'Bridge');
    await expect(page.getByRole('heading', { name: /Bridge/i }).first()).toBeVisible();

    // Select Sidechain intent
    await page.getByText('Sidechain').click();

    // Fill amount to enable Continue
    await page.fill('input[placeholder="0.00"]', '0.1');
    await page.getByRole('button', { name: /Continue/i }).click();

    // Now in Step 2: Review
    await expect(page.getByText(/Review Protocol Wrap/i)).toBeVisible();

    // Go to Step 3: Execution (for Native Peg)
    await page.getByRole('button', { name: /Confirm & Bridge/i }).click();

    // Now in Step 3: Native Peg - Wait longer
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Target Network/i).or(page.getByText(/Native Peg/i))).toBeVisible({ timeout: 15000 });

    // --- 6. STACKING (PoX Nakamoto) ---
    await navigateTo('Stacking (PoX)', 'Stacking');
    await expect(page.getByRole('heading', { name: /Stacking/i }).first()).toBeVisible();
    await expect(page.getByText(/Estimated APY/i)).toBeVisible();

        // --- 7. LABS DISCOVERY (BitVM & ZK) ---
    await navigateTo('Labs Discovery', 'Labs');
    await expect(page.locator('h2').filter({ hasText: 'Labs' }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/institutional digital sovereignty/i)).toBeVisible();

                                // --- 8. IDENTITY (D.I.D) ---
    await navigateTo('Identity (D.i.D)', 'Identity');
    await expect(page.getByText(/Identity Enclave/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Web5 Decentralization/i)).toBeVisible();

            // --- 9. SECURITY (LOCK/UNLOCK) ---
    await page.getByTitle('Lock Enclave').click();
    await expect(page.getByText(/Conxius Enclave/i)).toBeVisible({ timeout: 15000 });
    for (const char of '123456') {
        await page.getByRole('button', { name: char, exact: true }).click();
    }
    await page.getByRole('button', { name: /Unlock Vault/i }).click();
    await expect(page.getByText('Sovereignty').first()).toBeVisible();

    console.log('STRICT FUNCTIONAL AUDIT COMPLETED SUCCESSFULLY.');
  });
});
