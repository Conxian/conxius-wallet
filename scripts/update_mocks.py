import re

mock_assets_replacement = """export const MOCK_ASSETS: any[] = [
  { id: 'btc-1', name: 'Bitcoin', symbol: 'BTC', balance: 1.5, valueUsd: 142500.00, layer: 'Mainnet', type: 'Native' },
  { id: 'stx-1', name: 'Stacks', symbol: 'STX', balance: 50000.0, valueUsd: 110000.00, layer: 'Stacks', type: 'Native' },
  { id: 'lbtc-1', name: 'Liquid BTC', symbol: 'L-BTC', balance: 0.5, valueUsd: 47500.00, layer: 'Liquid', type: 'Native' },
  { id: 'rbtc-1', name: 'Rootstock BTC', symbol: 'RBTC', balance: 0.1, valueUsd: 9500.00, layer: 'Rootstock', type: 'Native' },
  { id: 'rgb-1', name: 'Sovereign Dollar', symbol: 'sUSD', balance: 100000, valueUsd: 100000.00, layer: 'RGB', type: 'RGB' },
  { id: 'bob-1', name: 'BOB BTC', symbol: 'BOB-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'BOB', type: 'Native' },
  { id: 'b2-1', name: 'B2 BTC', symbol: 'B2-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'B2', type: 'Native' },
  { id: 'bot-1', name: 'Botanix BTC', symbol: 'BOT-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Botanix', type: 'Native' },
  { id: 'mez-1', name: 'Mezo BTC', symbol: 'MEZO-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Mezo', type: 'Native' },
  { id: 'alp-1', name: 'Alpen BTC', symbol: 'ALP-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Alpen', type: 'Native' },
  { id: 'zul-1', name: 'Zulu BTC', symbol: 'ZULU-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Zulu', type: 'Native' },
  { id: 'bis-1', name: 'Bison BTC', symbol: 'BIS-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Bison', type: 'Native' },
  { id: 'hem-1', name: 'Hemi BTC', symbol: 'HEMI-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Hemi', type: 'Native' },
  { id: 'nub-1', name: 'Nubit BTC', symbol: 'NUB-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Nubit', type: 'Native' },
  { id: 'lor-1', name: 'Lorenzo BTC', symbol: 'LOR-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Lorenzo', type: 'Native' },
  { id: 'cit-1', name: 'Citrea BTC', symbol: 'CIT-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Citrea', type: 'Native' },
  { id: 'bab-1', name: 'Babylon BTC', symbol: 'BAB-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Babylon', type: 'Native' },
  { id: 'mer-1', name: 'Merlin BTC', symbol: 'MER-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Merlin', type: 'Native' },
  { id: 'bit-1', name: 'Bitlayer BTC', symbol: 'BIT-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Bitlayer', type: 'Native' },
  { id: 'tap-1', name: 'Taproot Asset', symbol: 'TAPT', balance: 1000000, valueUsd: 10000.00, layer: 'TaprootAssets', type: 'Native' },
];"""

with open('constants.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'export const MOCK_ASSETS: any\[\] = \[.*?\];', mock_assets_replacement, content, flags=re.DOTALL)

with open('constants.tsx', 'w') as f:
    f.write(content)
