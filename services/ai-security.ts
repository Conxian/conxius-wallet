import { generateRandomString } from "./random";

/**
 * AI Security & Privacy Layer (Sovereign AI v1.1)
 * Ensures zero-leak of sensitive cryptographic identifiers to external LLM providers.
 */

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

  // 4. Redact Transaction IDs / Private Keys (64-char hex)
  const hex64Regex = /\b([a-fA-F0-9]{64})\b/g;
  sanitized = sanitized.replace(hex64Regex, (match) => {
    const id = `[HEX64_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 5. Redact BIP32 Extended Keys (xpub/xprv etc)
  const xkeyRegex = /\b([xtuvyz](?:pub|prv)[1-9A-HJ-NP-Za-km-z]{50,110})\b/g;
  sanitized = sanitized.replace(xkeyRegex, (match) => {
    const id = `[EXT_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  return { sanitized, redactionMap };
};

/**
 * Detects common prompt injection patterns or malicious intents.
 */
export const isPromptMalicious = (text: string): boolean => {
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
  let rehydrated = text;
  Object.keys(redactionMap).forEach((id) => {
    // Only replace if the ID is explicitly present in the response
    rehydrated = rehydrated.split(id).join(redactionMap[id]);
  });
  return rehydrated;
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
