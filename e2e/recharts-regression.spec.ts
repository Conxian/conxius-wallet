import { test, expect, type Page } from '@playwright/test';
import { openFeature, resetBrowserState, waitForWalletShell } from './helpers';

async function installChartFixtures(page: Page): Promise<void> {
  await page.route('**/v2/pox*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        current_cycle: {
          id: 123,
          stacked_ustx: '0',
          total_weight: 4000,
        },
        next_cycle: {
          min_threshold_ustx: '125000000000',
          reward_phase_start_block_height: 0,
        },
        current_burnchain_block_height: 0,
        reward_cycle_length: 2100,
      }),
    });
  });

  await page.route('**/extended/v1/burnchain/rewards/*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [] }),
    });
  });

  await page.route('**/extended/v1/sbtc/supply*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSbtc: 280,
        totalBtcLocked: 350,
        ratio: 1.25,
      }),
    });
  });

  await page.route('**/api.coingecko.com/api/v3/simple/price*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bitcoin: { usd: 100000 }, stacks: { usd: 1 } }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await installChartFixtures(page);
  await resetBrowserState(page);
  await page.goto('/');
  await waitForWalletShell(page);
});

test('reserves renders a named pie chart with real sectors', async ({ page }) => {
  await openFeature(page, 'Reserves', 'Reserves');

  const allocationCard = page.getByRole('heading', { name: 'Reserve Allocation', exact: true }).locator('..');
  const chart = allocationCard.locator('svg.recharts-surface[role="application"]');

  await expect(chart).toHaveCount(1);
  await expect(chart).toHaveAccessibleName('Reserve Allocation');
  await expect(chart).toHaveAccessibleDescription('Verified reserve allocation by asset.');
  await expect(page.getByText('Stacks (sBTC)', { exact: true })).toBeVisible();

  const sectors = chart.locator('.recharts-pie-sector');
  await expect(sectors.first().locator('path')).toHaveAttribute('d', /\S+/);
  expect(await sectors.count()).toBeGreaterThan(0);
});

test('benchmark renders two named radar polygons in Chromium and mobile Chrome', async ({ page }) => {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    // Benchmark is not exposed in MobileMenu. Use the existing Sidebar control
    // already mounted by App so the component renders at the mobile viewport
    // without changing product navigation just for regression coverage.
    await page.locator('button').filter({ hasText: /^Benchmark$/ }).first().evaluate((button) => (button as HTMLButtonElement).click());
  } else {
    await openFeature(page, 'Benchmark', 'Benchmark');
  }

  const benchmarkCard = page.getByRole('heading', { name: 'Sovereignty Moat Visualization', exact: true }).locator('..');
  const chart = benchmarkCard.locator('svg.recharts-surface[role="application"]');

  await expect(chart).toHaveCount(1);
  await expect(chart).toHaveAccessibleName('Sovereignty Moat Visualization');
  await expect(chart).toHaveAccessibleDescription(
    'Conxius and industry benchmark scores across sovereignty dimensions.',
  );

  const polygons = chart.locator('.recharts-radar-polygon');
  await expect(polygons).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expect(polygons.nth(index).locator('path')).toHaveAttribute('d', /\S+/);
  }
});

test('empty stacking renders the named fallback chart without an area curve', async ({ page }) => {
  await openFeature(page, 'Stacking (PoX)', 'Stacking');

  const chartCard = page.getByRole('heading', { name: 'Yield Performance', exact: true }).locator('..').locator('..');
  const chart = chartCard.locator('svg.recharts-surface[role="application"]');

  await expect(chart).toHaveCount(1);
  await expect(chart).toHaveAccessibleName('Yield Performance');
  await expect(chart).toHaveAccessibleDescription('BTC rewards earned per stacking cycle.');
  await expect(chart).toHaveAttribute('tabindex', '0');
  await expect(chart).toContainText('—');
  await expect(chart.locator('.recharts-area-curve')).toHaveCount(0);
});
