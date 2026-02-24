import { BitcoinLayer } from './types';

export const APP_VERSION = '0.3.0';

export const INITIAL_BOUNTIES: any[] = [
  { id: '1', title: 'Implement BIP-352 SP', description: 'Integrate Silent Payments for enhanced privacy.', reward: '0.005 BTC', category: 'Security', status: 'Open', difficulty: 'Elite', expiry: '2026-06-01' },
  { id: '2', title: 'Sovereign Node Dashboard', description: 'Visualizing local Bitcoin node health and stats.', reward: '0.002 BTC', category: 'Core', status: 'Open', difficulty: 'Intermediate', expiry: '2026-05-15' },
  { id: '3', title: 'Localized Hebrew Translation', description: 'Full RTL support for the Sovereign interface.', reward: '0.001 BTC', category: 'UI/UX', status: 'Open', difficulty: 'Beginner', expiry: '2026-04-20' },
];

export const MOCK_ASSETS: any[] = [
  { id: 'btc-1', name: 'Bitcoin', symbol: 'BTC', balance: 0.1245, valueUsd: 11827.50, layer: 'Mainnet', type: 'Native' },
  { id: 'stx-1', name: 'Stacks', symbol: 'STX', balance: 1420.5, valueUsd: 3125.10, layer: 'Stacks', type: 'Native' },
  { id: 'lbtc-1', name: 'Liquid BTC', symbol: 'L-BTC', balance: 0.05, valueUsd: 4750.00, layer: 'Liquid', type: 'Native' },
  { id: 'rbtc-1', name: 'Rootstock BTC', symbol: 'RBTC', balance: 0.01, valueUsd: 950.00, layer: 'Rootstock', type: 'Native' },
  { id: 'rgb-1', name: 'Sovereign Dollar', symbol: 'sUSD', balance: 1000, valueUsd: 1000.00, layer: 'RGB', type: 'RGB' },
];

export const MOCK_CITADEL_MEMBERS: any[] = [
  { id: '1', name: 'Architect-01', role: 'Architect', sovereigntyScore: 100, nodeStatus: 'Online', stackedAmount: 50000, votingPower: 25 },
  { id: '2', name: 'Guardian-Alpha', role: 'Guardian', sovereigntyScore: 98, nodeStatus: 'Online', stackedAmount: 25000, votingPower: 12 },
  { id: '3', name: 'Initiate-77', role: 'Initiate', sovereigntyScore: 75, nodeStatus: 'Leech', stackedAmount: 1000, votingPower: 0.5 },
];

export const MOCK_RESERVE_ASSETS: any[] = [
  { asset: "Bitcoin (L1)", totalSupplied: 45.2, totalReserves: 50.0, collateralRatio: 110, status: "Audited" },
  { asset: "Stacks (sBTC)", totalSupplied: 281.2, totalReserves: 352.5, collateralRatio: 125, status: "Audited" },
  { asset: "Liquid (L-BTC)", totalSupplied: 12.5, totalReserves: 15.0, collateralRatio: 120, status: "Verified" },
];

export const LAYER_COLORS: Record<BitcoinLayer, string> = {
  'Mainnet': 'bg-orange-500',
  'Stacks': 'bg-purple-600',
  'Rootstock': 'bg-blue-600',
  'Ethereum': 'bg-blue-400',
  'Lightning': 'bg-yellow-400',
  'Liquid': 'bg-emerald-500',
  'Runes': 'bg-pink-600',
  'Ordinals': 'bg-gray-400',
  'BOB': 'bg-indigo-600',
  'RGB': 'bg-blue-500',
  'Ark': 'bg-red-400',
  'BitVM': 'bg-green-600',
  'StateChain': 'bg-zinc-400',
  'Maven': 'bg-cyan-500',
  'B2': 'bg-orange-700',
  'Botanix': 'bg-emerald-700',
  'Mezo': 'bg-blue-900',
  'Alpen': 'bg-slate-500',
  'Zulu': 'bg-lime-600',
  'Bison': 'bg-amber-800',
  'Hemi': 'bg-rose-700',
  'Nubit': 'bg-sky-500',
  'Lorenzo': 'bg-teal-600',
  'Citrea': 'bg-violet-700',
  'Babylon': 'bg-red-700',
  'Merlin': 'bg-fuchsia-800',
  'Bitlayer': 'bg-stone-600',
  'TaprootAssets': 'bg-orange-400',
};

export const MOCK_TRANSACTIONS: any[] = [
  { id: 'tx-1', type: 'receive', asset: 'BTC', amount: 0.05, status: 'completed', timestamp: Date.now() - 3600000, layer: 'Mainnet' },
  { id: 'tx-2', type: 'send', asset: 'STX', amount: 100, status: 'pending', timestamp: Date.now() - 1800000, layer: 'Stacks' },
];

export const MOCK_HISTORICAL_REWARDS: any[] = [
  { cycle: 78, amount: 1.2, timestamp: Date.now() - 86400000 * 15 },
  { cycle: 79, amount: 1.5, timestamp: Date.now() - 86400000 * 30 },
];
