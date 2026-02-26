import { test, expect } from '@playwright/test';

test.describe('Full Wallet System Integration', () => {

  test.beforeEach(async ({ page }) => {
    // Mock UTXO API
    await page.route('**/address/*/utxo', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { txid: 'f'.repeat(64), vout: 0, value: 100000000, status: { confirmed: true } },
          { txid: 'e'.repeat(64), vout: 1, value: 50000000, status: { confirmed: true } }
        ])
      });
    });

    // Mock Fee API
    await page.route('**/fees/recommended', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fastestFee: 20, halfHourFee: 15, hourFee: 10, economyFee: 5, minimumFee: 1 })
      });
    });

    // Mock Stacking API
    await page.route('**/v2/pox', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ current_cycle: { id: 80 }, next_cycle: { min_threshold_ustx: '1000000000' } })
      });
    });

    await page.goto('/');
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
    await page.reload();
  });

  test('Complete User Journey: Onboarding to Advanced Features', async ({ page, viewport }) => {
    test.setTimeout(300_000);

    // 1. Onboarding
    await expect(page.locator('text=Conxian-Labs')).toBeVisible({ timeout: 15_000 });

    // Select Simulation Mode
    const simulationBtn = page.locator('button:has-text("Simulation")');
    await expect(simulationBtn).toBeVisible({ timeout: 15_000 });
    await simulationBtn.click();

    // Start -> Create Vault
    await page.click('text=Create Vault');

    // Type -> Personal Vault
    await page.click('text=Personal Vault');
    await page.click('text=Continue to Entropy Scan');

    // Entropy Gathering
    await expect(page.locator('text=Gathering Entropy')).toBeVisible();
    for (let i = 0; i < 250; i++) {
        await page.mouse.move(100 + (i % 50) * 5, 100 + (Math.floor(i / 50)) * 5);
        if (i % 25 === 0) await page.waitForTimeout(50);
    }

    // Wait for Security step
    await expect(page.locator('text=Secure Enclave')).toBeVisible({ timeout: 60_000 });

    // Set PIN
    const pinInputs = page.locator('input[type="password"]');
    await pinInputs.nth(0).fill('1234');
    await pinInputs.nth(1).fill('1234');
    await page.click('text=Confirm Encryption');

    // Backup
    await expect(page.locator('text=Master Seed Backup')).toBeVisible();
    await page.click('text=Reveal Phrase');
    const words = await page.evaluate(() => {
        const wordElements = document.querySelectorAll('span.text-xs.font-bold.text-zinc-300');
        return Array.from(wordElements).map(el => el.textContent || '');
    });
    await page.click('text=Verify Backup');

    // Verification
    await page.waitForSelector('label:has-text("Word #")');
    const indicesToVerify = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label')).filter(l => l.textContent?.includes('Word #'));
        return labels.map(l => parseInt(l.textContent?.split('#')[1] || '0') - 1);
    });
    for (let i = 0; i < indicesToVerify.length; i++) {
        await page.locator('input[type="password"]').nth(i).fill(words[indicesToVerify[i]]);
    }
    await page.click('text=Initialize Enclave');

    // 2. Dashboard
    await expect(page.locator('p:has-text("Sovereignty")').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('text=Bitcoin')).toBeVisible();
    await expect(page.locator('p:has-text("1.50 BTC")').first()).toBeVisible();

    const isMobile = (viewport?.width || 0) < 768;
    const navigateTo = async (desktopLabel: string, mobileLabel: string) => {
        if (isMobile) {
            await page.click('button:has-text("Menu")');
            await page.locator('div.grid-cols-4 button').filter({ hasText: mobileLabel }).click();
        } else {
            await page.locator('nav button').filter({ hasText: desktopLabel }).click();
        }
    };

    // DeFi
    await navigateTo('DeFi Enclave', 'DeFi');
    await expect(page.locator('h2:has-text("DeFi")')).toBeVisible();

    // Bridge
    await navigateTo('NTT Bridge', 'Bridge');
    await expect(page.locator('h2:has-text("Bridge")')).toBeVisible();

    // Staking
    await navigateTo('Stacking (PoX)', 'Stacking');
    await expect(page.locator('h2:has-text("Stacking")')).toBeVisible();

    // Labs
    await navigateTo('Labs Discovery', 'Labs');
    await expect(page.locator('h2:has-text("Labs")')).toBeVisible();

    // 4. Transaction Simulation
    await navigateTo('Dashboard', 'Wallet');
    await page.click('button:has-text("Transmit")');
    await page.fill('input[placeholder="bc1q..."]', 'bc1qtestrecipient');
    await page.fill('input[placeholder="0"]', '10000'); // SATS

    // Wait for UTXOs to load (mocked)
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('input[type="checkbox"]').first().check();

    await page.click('button:has-text("Construct PSBT")');
    await expect(page.locator('text=Sign Transaction')).toBeVisible();
    await page.click('button:has-text("Sign Transaction")');

    await expect(page.locator('text=Broadcast to Mempool')).toBeVisible();
    // Broadcast is also mocked by default or will fail but we just check visibility of button

    // 5. Security (Lock/Unlock)
    await page.click('div[title="Lock Enclave"]');
    await expect(page.locator('text=Vault Locked')).toBeVisible();
    await page.fill('input[type="password"]', '1234');
    await page.click('button:has-text("Unlock")');
    await expect(page.locator('p:has-text("Sovereignty")').first()).toBeVisible();
  });
});
