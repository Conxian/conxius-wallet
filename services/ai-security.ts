import { generateRandomString } from "./random";

/**
 * AI Security & Privacy Layer (Sovereign AI v1.1)
 * Ensures zero-leak of sensitive cryptographic identifiers to external LLM providers.
 */

const MAX_PROMPT_LENGTH = 20000;

// Security: Normalize inputs by stripping non-printable and zero-width characters to prevent obfuscated leaks
// We exclude common whitespace (0x09, 0x0A, 0x0D) to preserve formatting.
const NORMALIZE_REGEX = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g;

/**
 * Redacts sensitive data from a string and returns a local mapping.
 * Supported: Bitcoin addresses, EVM addresses, TxIDs, Mnemonics, xprv/xpub.
 */
export const sanitizePrompt = (
  text: string,
): { sanitized: string; redactionMap: Record<string, string> } => {
  const redactionMap: Record<string, string> = {};

  const normalized = text.replace(NORMALIZE_REGEX, "");
  let sanitized = normalized;

  // 1. Redact BIP-39 Mnemonics (12-24 words)
  // Supports varied separators (spaces, hyphens, underscores, dots, digits) for defense-in-depth.
  const mnemonicRegex = /(?<![a-zA-Z0-9])(([a-z]{3,}[\s\W_0-9]+){11,23}[a-z]{3,})(?![a-zA-Z0-9])/gi;

  sanitized = sanitized.replace(mnemonicRegex, (match) => {
    const id = `[MNEMONIC_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 2. Redact Bitcoin Addresses (Legacy, Segwit, Taproot, Testnet)
  // bc1q..., bc1p..., 1..., 3..., tb1..., m/n...
  const btcRegex =
    /(?<![a-zA-Z0-9])(bc1[qp][a-z0-9]{33,58}|[13][a-km-zA-NP-Z1-9]{25,39}|tb1[qp][a-z0-9]{33,58}|[mn2][a-km-zA-NP-Z1-9]{25,39})(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(btcRegex, (match) => {
    const id = `[BTC_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 3. Redact EVM Addresses (0x...)
  const evmRegex = /(?<![a-zA-Z0-9])(0x[a-fA-F0-9]{40})(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(evmRegex, (match) => {
    const id = `[EVM_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 4. Redact Transaction IDs / Private Keys / Node IDs (64 or 66-char hex)
  const hexRegex = /(?<![a-zA-Z0-9])((?:0x)?[a-fA-F0-9]{64,66})(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(hexRegex, (match) => {
    const id = `[HEX_SEC_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 5. Redact Stacks Addresses (SP..., ST...)
  const stxRegex = /(?<![a-zA-Z0-9])(S[PST][0-9A-Z]{28,41})(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(stxRegex, (match) => {
    const id = `[STX_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 6. Redact Liquid Addresses (lq1..., tlq1..., elq1...)
  const liquidRegex = /(?<![a-zA-Z0-9])((?:lq|tlq|elq)1[qp][a-z0-9]{38,110})(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(liquidRegex, (match) => {
    const id = `[LIQUID_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 7. Redact BIP32 Extended Keys (xpub/xprv etc)
  const xkeyRegex = /(?<![a-zA-Z0-9])([xtuvyz](?:pub|prv)[1-9A-HJ-NP-Za-km-z]{50,110})(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(xkeyRegex, (match) => {
    const id = `[EXT_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 8. Redact Nostr Keys (nsec1, npub1)
  const nostrRegex = /(?<![a-zA-Z0-9])(nsec1[a-z0-9]{50,200}|npub1[a-z0-9]{50,200})(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(nostrRegex, (match) => {
    const id = `[NOSTR_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 9. Redact Silent Payment Addresses (sp1...)
  const spRegex = /(?<![a-zA-Z0-9])(sp1[a-z0-9]{50,200})(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(spRegex, (match) => {
    const id = `[SP_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 10. Redact Bitcoin WIF Private Keys (Mainnet & Testnet)
  const wifRegex = /(?<![a-zA-Z0-9])([5KL9c][1-9A-HJ-NP-Za-km-z]{50,51})(?![a-zA-Z0-9])/g;
  sanitized = sanitized.replace(wifRegex, (match) => {
    const id = `[WIF_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 11. Redact Lightning BOLT11 Invoices
  const bolt11Regex = /(?<![a-zA-Z0-9])(ln(?:bc|tb|bcrt|dev)[0-9a-z]+)(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(bolt11Regex, (match) => {
    const id = `[BOLT11_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 12. Redact AI Service API Keys (Google Gemini, OpenAI, etc.)
  const apiKeyRegex = /(?<![a-zA-Z0-9])(AIzaSy[a-zA-Z0-9_-]{33}|sk-[a-zA-Z0-9_-]{20,})(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(apiKeyRegex, (match) => {
    const id = `[API_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 13. Redact mashed mnemonics (last pass to avoid over-matching technical identifiers)
  const mashedMnemonicRegex = /(?<![a-zA-Z0-9])([a-z]{3,}){12}(?![a-zA-Z0-9])/gi;
  sanitized = sanitized.replace(mashedMnemonicRegex, (match) => {
    // Only redact if it doesn't look like a redaction placeholder
    if (match.startsWith('[') && match.includes('_') && match.endsWith(']')) return match;
    const id = `[MNEMONIC_${generateRandomString(4)}]`;
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

  const normalized = text.replace(NORMALIZE_REGEX, "");
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

  return injectionPatterns.some((p) => {
    // Create a regex that allows any amount of whitespace or punctuation between words
    // (handles newlines/tabs/underscores/dots) and also handles cases where words
    // are mashed together after ZWC stripping.
    const pattern = p
      .split(/\s+/)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s\\W_0-9]*");
    const regex = new RegExp(pattern, "i");
    return regex.test(normalized);
  });
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

  // Normalize map keys to uppercase for case-insensitive lookup
  const normalizedMap: Record<string, string> = {};
  for (const key of ids) {
    normalizedMap[key.toUpperCase()] = redactionMap[key];
  }

  // Single-pass rehydration: Prevents double-substitution and improves performance.
  // Escapes special regex characters in the redaction IDs.
  // Using 'gi' for case-insensitive rehydration to handle AI variations.
  const pattern = new RegExp(
    ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "gi",
  );

  return text.replace(pattern, (matched) => {
    // Normalizing lookup to handle case-insensitive matches.
    const key = matched.toUpperCase();
    return normalizedMap[key] || matched;
  });
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
