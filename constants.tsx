
import React from 'react';
import { Asset, BitcoinLayer, Transaction, ReserveAsset } from './types';

export const LAYERS: BitcoinLayer[] = ['Mainnet', 'Stacks', 'Rootstock', 'Ethereum', 'Lightning', 'Liquid', 'Runes', 'Ordinals', 'BOB', 'RGB', 'Ark', 'BitVM', 'StateChain', 'Maven'];

export const MOCK_ASSETS: Asset[] = [
  { id: 'btc-main', name: 'Bitcoin', symbol: 'BTC', balance: 1.42, valueUsd: 92300, layer: 'Mainnet', type: 'Native' },
  { id: 'stx-l2', name: 'Stacks', symbol: 'STX', balance: 12500, valueUsd: 25000, layer: 'Stacks', type: 'Native' },
  { id: 'ordi-brc', name: 'ORDI', symbol: 'ORDI', balance: 50, valueUsd: 1500, layer: 'Ordinals', type: 'BRC-20' },
  { id: 'satoshi-rune', name: 'SATOSHI•NAKAMOTO', symbol: 'RUNES', balance: 1000000, valueUsd: 3200, layer: 'Runes', type: 'Rune' },
  { id: 'l-btc', name: 'Liquid BTC', symbol: 'L-BTC', balance: 0.05, valueUsd: 3250, layer: 'Liquid', type: 'Wrapped' },
  { id: 'rbtc', name: 'Smart BTC', symbol: 'RBTC', balance: 0.12, valueUsd: 7800, layer: 'Rootstock', type: 'Native' },
  { id: 'welsh-stx', name: 'Welshcorgicoin', symbol: 'WELSH', balance: 500000, valueUsd: 450, layer: 'Stacks', type: 'SIP-10' },
  { id: 'bob-native', name: 'BOB BTC', symbol: 'BOB-BTC', balance: 0.12, valueUsd: 7800, layer: 'BOB', type: 'Native' },  { id: 'rgb-usd', name: 'Sovereign Dollar', symbol: 'USDS', balance: 1000, valueUsd: 1000, layer: 'RGB', type: 'RGB' },  { id: 'ark-vtxo', name: 'Ark VTXO', symbol: 'aBTC', balance: 0.05, valueUsd: 3250, layer: 'Ark', type: 'Ark' },
];

export const MOCK_RESERVES: ReserveAsset[] = [
  { asset: 'L-BTC', totalSupplied: 142.5, totalReserves: 143.2, collateralRatio: 100.49, status: 'Healthy' },
  { asset: 'RBTC', totalSupplied: 89.2, totalReserves: 90.1, collateralRatio: 101.01, status: 'Healthy' },
  { asset: 'NTT Liquidity', totalSupplied: 500, totalReserves: 550, collateralRatio: 110.00, status: 'Healthy' },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', type: 'receive', asset: 'BTC', amount: 0.05, status: 'completed', timestamp: Date.now() - 3600000 * 2, layer: 'Mainnet', counterparty: 'Exchange' },
  { id: 'tx-2', type: 'send', asset: 'BTC', amount: 0.01, status: 'completed', timestamp: Date.now() - 3600000 * 24, layer: 'Mainnet', counterparty: 'bc1p...3k8' },
  { id: 'tx-3', type: 'bridge', asset: 'STX', amount: 500, status: 'completed', timestamp: Date.now() - 3600000 * 48, layer: 'Stacks', counterparty: 'NTT Bridge' },
  { id: 'tx-4', type: 'receive', asset: 'ORDI', amount: 10, status: 'completed', timestamp: Date.now() - 3600000 * 5, layer: 'Ordinals', counterparty: 'MagicEden' },
  { id: 'tx-5', type: 'receive', asset: 'RUNES', amount: 50000, status: 'pending', timestamp: Date.now() - 600000, layer: 'Runes', counterparty: 'Unknown' },
];

export const MOCK_DEFI_POSITIONS = [
  { id: 'pos-1', protocol: 'Alex', pair: 'STX-aBTC', type: 'Liquidity Pool', value: '$12,450', apy: '14.2%', layer: 'Stacks', risk: 'Medium' },
  { id: 'pos-2', protocol: 'Sovryn', pair: 'RBTC-USDT', type: 'Lending', value: '$5,200', apy: '8.5%', layer: 'Rootstock', risk: 'Low' },
  { id: 'pos-3', protocol: 'Velar', pair: 'STX-WELSH', type: 'Farm', value: '$1,800', apy: '42.0%', layer: 'Stacks', risk: 'High' },
];

export const MOCK_YIELD_DATA = [
  { month: 'Jan', yield: 4.2 },
  { month: 'Feb', yield: 5.1 },
  { month: 'Mar', yield: 4.8 },
  { month: 'Apr', yield: 6.2 },
  { month: 'May', yield: 5.9 },
  { month: 'Jun', yield: 7.4 },
];

export const MOCK_HISTORICAL_REWARDS = [
  { cycle: '74', btc: 0.0021, date: 'Oct 12' },
  { cycle: '75', btc: 0.0019, date: 'Oct 26' },
  { cycle: '76', btc: 0.0022, date: 'Nov 09' },
  { cycle: '77', btc: 0.0020, date: 'Nov 23' },
  { cycle: '78', btc: 0.0021, date: 'Dec 07' },
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
  'BOB': 'bg-indigo-600',  'RGB': 'bg-blue-500',  'Ark': 'bg-red-400',  'BitVM': 'bg-green-600',  'StateChain': 'bg-zinc-400',  'Maven': 'bg-cyan-500',
};
