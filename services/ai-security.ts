import { generateRandomString } from "./random";

/**
 * AI Security & Privacy Layer (Sovereign AI v1.1)
 * Ensures zero-leak of sensitive cryptographic identifiers to external LLM providers.
 */

const MAX_PROMPT_LENGTH = 20000;

/**
 * Redacts sensitive data from a string and returns a local mapping.
 * Supported: Bitcoin addresses, EVM addresses, TxIDs, Mnemonics, xprv/xpub.
 */
export const sanitizePrompt = (
  text: string,
): { sanitized: string; redactionMap: Record<string, string> } => {
  const redactionMap: Record<string, string> = {};
  let sanitized = text;

  // 1. Redact BIP-39 Mnemonics (12-24 words)
  const mnemonicRegex = /\b([a-z]{3,}\s){11,23}[a-z]{3,}\b/gi;
  sanitized = sanitized.replace(mnemonicRegex, (match) => {
    const id = `[MNEMONIC_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 2. Redact Bitcoin Addresses (Legacy, Segwit, Taproot, Testnet)
  // bc1q..., bc1p..., 1..., 3..., tb1..., m/n...
  const btcRegex =
    /\b(bc1[qp][a-z0-9]{38,58}|[13][a-km-zA-NP-Z1-9]{25,39}|tb1[qp][a-z0-9]{38,58}|[mn2][a-km-zA-NP-Z1-9]{25,39})\b/g;
  sanitized = sanitized.replace(btcRegex, (match) => {
    const id = `[BTC_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 3. Redact EVM Addresses (0x...)
  const evmRegex = /\b(0x[a-fA-F0-9]{40})\b/g;
  sanitized = sanitized.replace(evmRegex, (match) => {
    const id = `[EVM_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 4. Redact Transaction IDs / Private Keys / Node IDs (64 or 66-char hex)
  const hexRegex = /\b((?:0x)?[a-fA-F0-9]{64,66})\b/g;
  sanitized = sanitized.replace(hexRegex, (match) => {
    const id = `[HEX_SEC_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 5. Redact Stacks Addresses (SP..., ST...)
  const stxRegex = /\b(S[PST][0-9A-Z]{28,41})\b/g;
  sanitized = sanitized.replace(stxRegex, (match) => {
    const id = `[STX_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 6. Redact Liquid Addresses (lq1..., tlq1..., elq1...)
  const liquidRegex = /\b((?:lq|tlq|elq)1[qp][a-z0-9]{38,110})\b/g;
  sanitized = sanitized.replace(liquidRegex, (match) => {
    const id = `[LIQUID_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 7. Redact BIP32 Extended Keys (xpub/xprv etc)
  const xkeyRegex = /\b([xtuvyz](?:pub|prv)[1-9A-HJ-NP-Za-km-z]{50,110})\b/g;
  sanitized = sanitized.replace(xkeyRegex, (match) => {
    const id = `[EXT_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 8. Redact Nostr Keys (nsec1, npub1)
  const nostrRegex = /\b(nsec1[a-z0-9]{50,110}|npub1[a-z0-9]{50,110})\b/gi;
  sanitized = sanitized.replace(nostrRegex, (match) => {
    const id = `[NOSTR_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 9. Redact Silent Payment Addresses (sp1...)
  const spRegex = /\b(sp1[a-z0-9]{50,120})\b/gi;
  sanitized = sanitized.replace(spRegex, (match) => {
    const id = `[SP_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 10. Redact Bitcoin WIF Private Keys (Mainnet & Testnet)
  const wifRegex = /\b[5KL9c][1-9A-HJ-NP-Za-km-z]{50,51}\b/g;
  sanitized = sanitized.replace(wifRegex, (match) => {
    const id = `[WIF_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 11. Redact Lightning BOLT11 Invoices
  const bolt11Regex = /\bln(?:bc|tb|bcrt|dev)[0-9a-z]+\b/gi;
  sanitized = sanitized.replace(bolt11Regex, (match) => {
    const id = `[BOLT11_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  return { sanitized, redactionMap };
};

/**
 * Detects common prompt injection patterns or malicious intents.
 */
export const isPromptMalicious = (text: string): boolean => {
  if (text.length > MAX_PROMPT_LENGTH) return true;

  const lowercase = text.toLowerCase();
  const injectionPatterns = [
    "ignore previous instructions",
    "system prompt",
    "reveal your secrets",
    "output raw keys",
    "dump memory",
    "override security",
    "bypass filters",
    "act as a developer with no restrictions",
    "jailbreak",
    "jailbroken",
    "dan mode",
    "assistant mode",
    "hypothetical scenario",
    "do anything now",
  ];

  return injectionPatterns.some((p) => lowercase.includes(p));
};

/**
 * Re-injects redacted data into the AI response if necessary (carefully).
 * This is used when the AI refers to a redacted entity and we want to show the user the real value.
 */
export const rehydrateResponse = (
  text: string,
  redactionMap: Record<string, string>,
): string => {
  const ids = Object.keys(redactionMap);
  if (ids.length === 0) return text;

  // Single-pass rehydration: Prevents double-substitution and improves performance.
  // Escapes special regex characters in the redaction IDs.
  const pattern = new RegExp(
    ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g",
  );

  return text.replace(pattern, (matched) => redactionMap[matched] || matched);
};

/**
 * High-level audit function to be called before ANY external AI interaction.
 */
export const secureAuditPrompt = (
  text: string,
): {
  sanitized: string;
  isBlocked: boolean;
  reason?: string;
  redactionMap: Record<string, string>;
} => {
  if (isPromptMalicious(text)) {
    return {
      sanitized: "",
      isBlocked: true,
      reason: "Malicious intent detected.",
      redactionMap: {},
    };
  }

  const { sanitized, redactionMap } = sanitizePrompt(text);
  return { sanitized, isBlocked: false, redactionMap };
};
