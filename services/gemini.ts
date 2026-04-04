import { Asset } from "../types";
import { callAi } from './ai';

/**
 * Gemini-specific wrappers using the unified AI service.
 */

export const getBountyAudit = async (bountyTitle: string, description: string) => {
  const prompt = `Perform a technical audit of the following development bounty:
  Title: "${bountyTitle}"
  Description: "${description}"

  Requirements:
  1. Evaluate the technical feasibility within the Conxius Enclave architecture.
  2. Identify potential security risks (e.g., side-channel attacks on local keys).
  3. Recommend a fair reward in BTC/STX based on the complexity.
  4. Suggest 3 specific acceptance criteria for the Conxius Treasury multisig to verify before release.`;

  return callAi(prompt, {
    model: 'gemini-1.5-pro',
    systemInstruction: "You are the Conxius Lead Auditor. You ensure all community contributions maintain the highest standards of sovereignty and security.",
    thinkingBudget: 32768
  });
};

export const generateReleaseNotes = async (version: string) => {
  const prompt = `Generate a high-density, professional 'Cypherpunk' style release report for Conxius Wallet SVN ${version}.
  Highlight:
  - The transition to BSL 1.1 Licensing.
  - Integrated System Health CXN Guardian.
  - Native Wormhole NTT Bridge stabilization.
  - Sovereign Studio expansion (Ordinals/Runes).
  - DAO Bounty Integration for community devs.
  The tone should be clinical, authoritative, and visionary.`;

  return callAi(prompt, {
    model: 'gemini-1.5-pro',
    systemInstruction: "You are the Chief Technical Evangelist at Conxian-Labs.",
    thinkingBudget: 32768
  });
};

export const getSystemHealthSummary = async (testResults: any[]) => {
  const resultsStr = testResults.map(r => `${r.label}: ${r.status}`).join(', ');
  const prompt = `Provide a clinical, high-density system health summary for the Conxius Sovereign Enclave based on these diagnostic results: ${resultsStr}.
  Evaluate the risk level (Low/Medium/High) and provide a "Protocol Directive".`;

  return callAi(prompt, {
    model: 'gemini-1.5-flash',
    systemInstruction: "You are the Conxius CXN Guardian System."
  });
};

export const getNetworkRPCResearch = async (layer: string) => {
  const prompt = `Research into RPC infrastructure for: "${layer}". Identify top 3 providers and one Tor endpoint.`;
  return callAi(prompt, {
    model: 'gemini-1.5-flash',
    systemInstruction: "You are the Conxius Infrastructure Lead."
  });
};

export const getFinalSystemHardeningChecklist = async () => {
  const prompt = "Provide a 5-point 'Hardened Mainnet' checklist for a Bitcoin multi-layer wallet. Focus on cold storage, Tor V3, ZK identity, NTT immutability, and fallback.";
  return callAi(prompt, {
    model: 'gemini-1.5-pro',
    systemInstruction: "You are a cyber-security expert.",
    thinkingBudget: 32768
  });
};

export const getDeploymentReadinessAudit = async (state: any) => {
  const prompt = `Final Go/No-Go audit. Node Sync: ${state.nodeSyncProgress}%, Sovereignty Score: ${state.sovereigntyScore}. Evaluate readiness for mainnet.`;
  return callAi(prompt, {
    model: 'gemini-1.5-pro',
    systemInstruction: "You are the Release Manager.",
    thinkingBudget: 32768
  });
};

export const getNodeEthosAdvice = async (path: string) => {
  const prompt = `Advise on the 'Sovereign Ethos' of: "${path}". Compare with custodial wallets.`;
  return callAi(prompt, {
    model: 'gemini-1.5-flash',
    systemInstruction: "You are the Satoshi Sovereign Researcher."
  });
};

export const getRiskProfileAudit = async (assets: Asset[]) => {
  const assetsSummary = assets.map(a => `${a.name} (${a.symbol}) on ${a.layer}`).join(', ');
  const prompt = `Risk audit for: ${assetsSummary}. Evaluate counterparty, liquidity, regulatory, and technical risks.`;
  return callAi(prompt, {
    model: 'gemini-1.5-pro',
    systemInstruction: "You are the Chief Risk Officer.",
    thinkingBudget: 32768
  });
};

export const getAssetInsight = async (asset: Asset) => {
  const prompt = `Technical analysis for ${asset.name} (${asset.symbol}) on ${asset.layer}.`;
  return callAi(prompt, {
    model: 'gemini-1.5-flash',
    systemInstruction: "You are Satoshi Pro AI."
  });
};

export const performDeepScan = async (assets: any[]) => {
  const assetsSummary = assets.map(a => `${a.name} (${a.symbol}) on ${a.layer}`).join(', ');
  const prompt = `Deep Scan: ${assetsSummary}. Provide risk scores, tax opportunities, and alpha.`;
  return callAi(prompt, {
    model: 'gemini-1.5-pro',
    systemInstruction: "You are Satoshi Pro AI.",
    thinkingBudget: 32768
  });
};

export const getDIDInsight = async (did: string) => {
  const prompt = `Audit Bitcoin DID: "${did}". Explain DPKI shift, PoW immutability, and sovereignty implications.`;
  return callAi(prompt, {
    model: 'gemini-1.5-pro',
    systemInstruction: "You are Satoshi AI.",
    thinkingBudget: 32768
  });
};

export const analyzePortfolio = async (assets: any[]) => {
  const assetsSummary = assets.map(a => `${a.name} (${a.symbol}) on ${a.layer}`).join(', ');
  const prompt = `Analyze portfolio: ${assetsSummary}.`;
  return callAi(prompt, {
    model: 'gemini-1.5-flash',
    systemInstruction: "You are the Portfolio Architect."
  });
};
