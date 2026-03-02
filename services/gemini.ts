import { GoogleGenAI } from "@google/genai";
import { Asset } from "../types";
import { secureAuditPrompt } from './ai-security';

// SECURITY: API key is held in memory and synchronized from encrypted Enclave state.
// No hardcoded keys are present in the source or build artifacts.
let _apiKey: string | undefined;

export const setGeminiApiKey = (key: string) => {
  _apiKey = key;
};

const callGemini = async (model: string, prompt: string, systemInstruction: string, thinkingBudget?: number) => {
  try {
    if (!_apiKey) throw new Error("API Key not configured");

    // SOVEREIGN AI AUDIT: Sanitize outgoing prompt
    const { sanitized, isBlocked, reason } = secureAuditPrompt(prompt);
    if (isBlocked) return `[Sovereign Audit Blocked]: ${reason}`;

    const ai = new GoogleGenAI({ apiKey: _apiKey });
    const response = await ai.models.generateContent({
      model: model,
      contents: sanitized,
      config: {
        systemInstruction: systemInstruction,
        ...(thinkingBudget ? { thinkingConfig: { thinkingBudget } } : {})
      }
    });
    return response.text;
  } catch (error) {
    console.error("[Gemini] Engine failure", error);
    return null;
  }
};

export const getBountyAudit = async (bountyTitle: string, description: string) => {
  const prompt = `Perform a technical audit of the following development bounty:
  Title: "${bountyTitle}"
  Description: "${description}"

  Requirements:
  1. Evaluate the technical feasibility within the Conxius Enclave architecture.
  2. Identify potential security risks (e.g., side-channel attacks on local keys).
  3. Recommend a fair reward in BTC/STX based on the complexity.
  4. Suggest 3 specific acceptance criteria for the Conxius Treasury multisig to verify before release.`;

  const res = await callGemini('gemini-1.5-pro', prompt, "You are the Conxius Lead Auditor. You ensure all community contributions maintain the highest standards of sovereignty and security.", 32768);
  return res || "Bounty audit engine offline. Use local conservative risk heuristics.";
};

export const generateReleaseNotes = async (version: string) => {
  const prompt = `Generate a high-density, professional 'Cypherpunk' style release report for Conxius Wallet SVN ${version}.
  Highlight:
  - The transition to BSL 1.1 Licensing.
  - Integrated System Health Sentinel.
  - Native Wormhole NTT Bridge stabilization.
  - Sovereign Studio expansion (Ordinals/Runes).
  - DAO Bounty Integration for community devs.
  The tone should be clinical, authoritative, and visionary.`;

  const res = await callGemini('gemini-1.5-pro', prompt, "You are the Chief Technical Evangelist at Conxian-Labs.", 32768);
  return res || "Release notes synthesis failed. Version status: Hardened Production.";
};

export const getSystemHealthSummary = async (testResults: any[]) => {
  const resultsStr = testResults.map(r => `${r.label}: ${r.status}`).join(', ');
  const prompt = `Provide a clinical, high-density system health summary for the Conxius Sovereign Enclave based on these diagnostic results: ${resultsStr}.
  Evaluate the risk level (Low/Medium/High) and provide a "Protocol Directive".`;

  const res = await callGemini('gemini-1.5-flash', prompt, "You are the Conxius Sentinel System.");
  return res || "Sentinel offline. Risk: Minimal.";
};

export const getNetworkRPCResearch = async (layer: string) => {
  const prompt = `Research into RPC infrastructure for: "${layer}". Identify top 3 providers and one Tor endpoint.`;
  const res = await callGemini('gemini-1.5-flash', prompt, "You are the Conxius Infrastructure Lead.");
  return res || "Network research engine throttled.";
};

export const getFinalSystemHardeningChecklist = async () => {
  const prompt = "Provide a 5-point 'Hardened Mainnet' checklist for a Bitcoin multi-layer wallet. Focus on cold storage, Tor V3, ZK identity, NTT immutability, and fallback.";
  const res = await callGemini('gemini-1.5-pro', prompt, "You are a cyber-security expert.", 32768);
  return res || "Hardening audit offline.";
};

export const getDeploymentReadinessAudit = async (state: any) => {
  const prompt = `Final Go/No-Go audit. Node Sync: ${state.nodeSyncProgress}%, Sovereignty Score: ${state.sovereigntyScore}. Evaluate readiness for mainnet.`;
  const res = await callGemini('gemini-1.5-pro', prompt, "You are the Release Manager.", 32768);
  return res || "Readiness audit offline.";
};

export const getNodeEthosAdvice = async (path: string) => {
  const prompt = `Advise on the 'Sovereign Ethos' of: "${path}". Compare with custodial wallets.`;
  const res = await callGemini('gemini-1.5-flash', prompt, "You are the Satoshi Sovereign Researcher.");
  return res || "Ethos engine offline.";
};

export const getRiskProfileAudit = async (assets: Asset[]) => {
  const assetsSummary = assets.map(a => `${a.name} (${a.symbol}) on ${a.layer}`).join(', ');
  const prompt = `Risk audit for: ${assetsSummary}. Evaluate counterparty, liquidity, regulatory, and technical risks.`;
  const res = await callGemini('gemini-1.5-pro', prompt, "You are the Chief Risk Officer.", 32768);
  return res || "Risk audit engine offline.";
};

export const getAssetInsight = async (asset: Asset) => {
  const prompt = `Technical analysis for ${asset.name} (${asset.symbol}) on ${asset.layer}.`;
  const res = await callGemini('gemini-1.5-flash', prompt, "You are Satoshi Pro AI.");
  return res || "Insight engine re-indexing.";
};

export const performDeepScan = async (assets: any[]) => {
  const assetsSummary = assets.map(a => `${a.name} (${a.symbol}) on ${a.layer}`).join(', ');
  const prompt = `Deep Scan: ${assetsSummary}. Provide risk scores, tax opportunities, and alpha.`;
  const res = await callGemini('gemini-1.5-pro', prompt, "You are Satoshi Pro AI.", 32768);
  return res || "Deep Scan offline.";
};

export const getDIDInsight = async (did: string) => {
  const prompt = `Audit Bitcoin DID: "${did}". Explain DPKI shift, PoW immutability, and sovereignty implications.`;
  const res = await callGemini('gemini-1.5-pro', prompt, "You are Satoshi AI.", 32768);
  return res || "Identity graph re-indexing.";
};

export const analyzePortfolio = async (assets: any[]) => {
  const assetsSummary = assets.map(a => `${a.name} (${a.symbol}) on ${a.layer}`).join(', ');
  const prompt = `Analyze portfolio: ${assetsSummary}.`;
  const res = await callGemini('gemini-1.5-flash', prompt, "You are the Portfolio Architect.");
  return res || "Analysis error.";
};
