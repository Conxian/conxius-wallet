/**
 * Stacking Service — Real PoX Data from Hiro API
 *
 * Fetches live Proof-of-Transfer cycle information, stacking status,
 * and reward history from the Hiro Stacks API.
 */

import { Network } from '../types';

const HIRO_MAINNET = 'https://api.mainnet.hiro.so';
const HIRO_TESTNET = 'https://api.testnet.hiro.so';

const getApiUrl = (network: Network) => {
  return network === 'testnet' ? HIRO_TESTNET : HIRO_MAINNET;
};

export interface PoxCycleInfo {
  currentCycle: number;
  nextCycleIn: number;        // blocks until next cycle
  totalStacked: number;       // total STX stacked in current cycle (microSTX)
  rewardSlots: number;
  minThreshold: number;       // minimum STX to participate (microSTX)
  blocksPerCycle: number;
  currentBurnBlockHeight: number;
}

export interface StackerInfo {
  isStacking: boolean;
  amountStacked: number;      // microSTX
  lockPeriod: number;         // cycles
  unlockHeight: number;
  poxAddress: string;
  rewardCycleStart: number;
}

export interface RewardEntry {
  cycle: string;
  btc: number;
  date: string;
}

const FETCH_TIMEOUT = 10000; // 10 seconds

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Fetches the current PoX cycle information from the Hiro API.
 */
export async function fetchPoxInfo(network: Network = 'mainnet'): Promise<PoxCycleInfo> {
  try {
    const baseUrl = getApiUrl(network);
    const response = await fetchWithTimeout(`${baseUrl}/v2/pox`);
    if (!response.ok) throw new Error(`Hiro PoX API error: ${response.status}`);
    const data = await response.json();

    const currentCycle = data.current_cycle?.id || data.reward_cycle_id || 0;
    const blocksPerCycle = data.reward_cycle_length || 2100;
    const currentBurnHeight = data.current_burnchain_block_height || 0;
    const nextCycleStart = data.next_cycle?.reward_phase_start_block_height || 0;
    const nextCycleIn = Math.max(0, nextCycleStart - currentBurnHeight);
    const minThreshold = parseInt(data.next_cycle?.min_threshold_ustx || data.min_amount_ustx || '125000000000');

    return {
      currentCycle,
      nextCycleIn,
      totalStacked: parseInt(data.current_cycle?.stacked_ustx || '0'),
      rewardSlots: data.current_cycle?.total_weight || data.reward_slots || 4000,
      minThreshold,
      blocksPerCycle,
      currentBurnBlockHeight: currentBurnHeight,
    };
  } catch (error) {
    console.warn('[Stacking] Failed to fetch PoX info:', error);
    return {
      currentCycle: 0,
      nextCycleIn: 0,
      totalStacked: 0,
      rewardSlots: 4000,
      minThreshold: 125000000000,
      blocksPerCycle: 2100,
      currentBurnBlockHeight: 0,
    };
  }
}

/**
 * Fetches stacking status for a specific STX address.
 */
export async function fetchStackerInfo(stxAddress: string, network: Network = 'mainnet'): Promise<StackerInfo> {
  try {
    const baseUrl = getApiUrl(network);
    const response = await fetch(`${baseUrl}/extended/v1/address/${stxAddress}/stacking`);
    if (!response.ok) {
      // Address might not be stacking — that's normal
      return { isStacking: false, amountStacked: 0, lockPeriod: 0, unlockHeight: 0, poxAddress: '', rewardCycleStart: 0 };
    }
    const data = await response.json();

    if (!data.stacker_info || data.stacker_info.length === 0) {
      return { isStacking: false, amountStacked: 0, lockPeriod: 0, unlockHeight: 0, poxAddress: '', rewardCycleStart: 0 };
    }

    const info = data.stacker_info[0] || data.stacker_info;
    return {
      isStacking: true,
      amountStacked: parseInt(info.amount_ustx || info.locked || '0'),
      lockPeriod: info.lock_period || 1,
      unlockHeight: info.unlock_height || 0,
      poxAddress: info.pox_address || '',
      rewardCycleStart: info.first_reward_cycle || 0,
    };
  } catch (error) {
    console.warn('[Stacking] Failed to fetch stacker info:', error);
    return { isStacking: false, amountStacked: 0, lockPeriod: 0, unlockHeight: 0, poxAddress: '', rewardCycleStart: 0 };
  }
}

/**
 * Fetches recent stacking reward history for a BTC reward address.
 * Returns the last N cycles of BTC rewards.
 */
export async function fetchRewardHistory(btcRewardAddress: string, network: Network = 'mainnet', limit: number = 8): Promise<RewardEntry[]> {
  if (!btcRewardAddress) return [];
  
  try {
    const baseUrl = getApiUrl(network);
    const response = await fetchWithTimeout(
      `${baseUrl}/extended/v1/burnchain/rewards/${btcRewardAddress}?limit=${limit}`
    );
    if (!response.ok) return [];
    const data = await response.json();

    return (data.results || []).map((r: any) => {
      const rewardDate = new Date(r.burn_block_time * 1000);
      return {
        cycle: `#${r.reward_cycle || '?'}`,
        btc: (parseInt(r.reward_amount || '0')) / 100_000_000,
        date: rewardDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
      };
    });
  } catch (error) {
    console.warn('[Stacking] Failed to fetch reward history:', error);
    return [];
  }
}

/**
 * Estimates annual APY for stacking based on current PoX data.
 * Uses: (total BTC rewards per cycle / total STX stacked) * cycles per year * (BTC/STX price ratio)
 */
export async function estimateStackingApy(network: Network = 'mainnet'): Promise<number> {
  try {
    const poxInfo = await fetchPoxInfo(network);
    if (poxInfo.totalStacked === 0) return 0;

    // Fetch current prices
    const priceResp = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,stacks&vs_currencies=usd'
    );
    if (!priceResp.ok) return 0;
    const prices = await priceResp.json();
    const btcPrice = prices.bitcoin?.usd || 0;
    const stxPrice = prices.stacks?.usd || 0;

    if (btcPrice === 0 || stxPrice === 0) return 0;

    // Approximate: ~0.01 BTC per slot per cycle, ~4000 slots
    // cycles per year ≈ 26 (2-week cycles)
    const cyclesPerYear = 26;
    const btcPerCycle = 3.125 * 6 * 2100 / 100_000_000; // subsidy * blocks / sat conversion (simplified)
    const totalStxUsd = (poxInfo.totalStacked / 1_000_000) * stxPrice;
    const btcRewardsUsd = btcPerCycle * btcPrice;

    const apy = (btcRewardsUsd * cyclesPerYear / totalStxUsd) * 100;
    return Math.min(apy, 25); // Cap at 25% to avoid nonsensical values
  } catch {
    return 0;
  }
}
