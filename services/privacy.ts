import { AppState, UTXO } from '../types';

export interface PrivacyScoreResult {
  score: number;
  breakdown: {
    network: number;
    scriptTypes: number;
    utxoHealth: number;
  };
  recommendations: string[];
}

export const calculatePrivacyScore = (state: AppState): PrivacyScoreResult => {
  let networkScore = state.isTorActive ? 100 : 0;

  // Script Types Score (Taproot / Segwit usage)
  const utxos = state.assets.flatMap(a => (a as any).utxos || []) as UTXO[];
  const totalUtxos = utxos.length;

  let taprootCount = 0;
  let lowRiskCount = 0;

  utxos.forEach(u => {
    // Basic heuristic for Taproot (P2TR) - address starts with bc1p
    if (u.address.startsWith('bc1p')) taprootCount++;
    if (u.privacyRisk === 'Low') lowRiskCount++;
  });

  const scriptScore = totalUtxos > 0 ? (taprootCount / totalUtxos) * 100 : 100;
  const utxoHealthScore = totalUtxos > 0 ? (lowRiskCount / totalUtxos) * 100 : 100;

  // Weighted average
  const totalScore = Math.round(
    (networkScore * 0.3) +
    (scriptScore * 0.3) +
    (utxoHealthScore * 0.4)
  );

  const recommendations: string[] = [];
  if (!state.isTorActive) recommendations.push("Enable Tor routing to hide your IP address.");
  if (totalUtxos > 0 && taprootCount / totalUtxos < 0.5) recommendations.push("Migrate funds to Taproot (BIP-341) for better on-chain privacy.");
  if (utxos.some(u => u.privacyRisk === 'High')) recommendations.push("You have high-risk UTXOs. Consider using CoinJoin or Silent Payments.");

  return {
    score: totalScore,
    breakdown: {
      network: networkScore,
      scriptTypes: Math.round(scriptScore),
      utxoHealth: Math.round(utxoHealthScore)
    },
    recommendations
  };
};
