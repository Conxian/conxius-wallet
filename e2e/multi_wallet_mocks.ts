import { Page } from '@playwright/test';

export const setupMultiWalletMocks = async (page: Page) => {
  // 1. Mock UTXO API for up to 10 addresses across different layers
  await page.route('**/address/*/utxo', async route => {
    const url = route.request().url();
    const address = url.split('/').slice(-2)[0];
    const addressIndex = address.includes('mock') ? parseInt(address.match(/\\d+/)?.[0] || '0') : 0;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { txid: 'f'.repeat(60) + addressIndex.toString(16).padStart(4, '0'), vout: 0, value: 100000000 + addressIndex * 1000, amount: 100000000 + addressIndex * 1000, status: { confirmed: true } },
        { txid: 'e'.repeat(60) + addressIndex.toString(16).padStart(4, '0'), vout: 1, value: 50000000 + addressIndex * 500, amount: 50000000 + addressIndex * 500, status: { confirmed: true } }
      ])
    });
  });

  // 2. Mock Balances for all 24+ layers
  await page.route('**/v2/address/*/balances', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stx: { balance: '10000000000', locked: '0' },
        fungible_tokens: {
           'SP3D6PV2ACBPEJPBT57ZYMSZ6S650TMK9G20X3X7B.sbtc': { balance: '500000000' }
        }
      })
    });
  });

  // 3. Mock EVM RPC for all L2s (BOB, B2, Alpen, etc.)
  await page.route('**/rpc', async route => {
    const postData = route.request().postDataJSON();
    if (postData?.method === 'eth_getBalance') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id: postData.id, result: '0xDE0B6B3A7640000' }) // 1 ETH
      });
    } else {
      await route.continue();
    }
  });

  // 4. Mock Fee Estimator
  await page.route('**/fees/recommended', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fastestFee: 25, halfHourFee: 20, hourFee: 15, economyFee: 10, minimumFee: 5 })
    });
  });

  // 5. Mock Stacking (PoX)
  await page.route('**/v2/pox', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        current_cycle: { id: 82, min_threshold_ustx: '100000000000' },
        next_cycle: { id: 83, min_threshold_ustx: '100000000000' }
      })
    });
  });

  // 6. Mock NTT Transceiver Status
  await page.route('**/ntt/status/*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'completed', signatures: 19, sourceTx: '0x...', targetTx: '0x...' })
    });
  });
};
