import { generateRandomString } from "./random";
import {
  NORMALIZE_REGEX,
  MNEMONIC_REGEX,
  MASHED_MNEMONIC_REGEX,
  BTC_ADDR_REGEX,
  EVM_ADDR_REGEX,
  HEX_SECRET_REGEX,
  STX_ADDR_REGEX,
  LIQUID_ADDR_REGEX,
  EXT_KEY_REGEX,
  NOSTR_KEY_REGEX,
  SP_ADDR_REGEX,
  WIF_KEY_REGEX,
  BOLT11_REGEX,
  API_KEY_REGEX,
} from "./security-constants";

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

  const normalized = text.replace(NORMALIZE_REGEX, "");
  let sanitized = normalized;

  // 1. Redact BIP-39 Mnemonics (12-24 words)
  sanitized = sanitized.replace(MNEMONIC_REGEX, (match) => {
    const id = `[MNEMONIC_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 2. Redact Bitcoin Addresses (Legacy, Segwit, Taproot, Testnet)
  sanitized = sanitized.replace(BTC_ADDR_REGEX, (match) => {
    const id = `[BTC_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 3. Redact EVM Addresses (0x...)
  sanitized = sanitized.replace(EVM_ADDR_REGEX, (match) => {
    const id = `[EVM_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 4. Redact Transaction IDs / Private Keys / Node IDs / 64-byte Seeds (64, 66, or 128-char hex)
  sanitized = sanitized.replace(HEX_SECRET_REGEX, (match) => {
    const id = `[HEX_SEC_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 5. Redact Stacks Addresses (SP..., ST...)
  sanitized = sanitized.replace(STX_ADDR_REGEX, (match) => {
    const id = `[STX_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 6. Redact Liquid Addresses (lq1..., tlq1..., elq1...)
  sanitized = sanitized.replace(LIQUID_ADDR_REGEX, (match) => {
    const id = `[LIQUID_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 7. Redact BIP32 Extended Keys (xpub/xprv etc)
  sanitized = sanitized.replace(EXT_KEY_REGEX, (match) => {
    const id = `[EXT_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 8. Redact Nostr Keys (nsec1, npub1)
  sanitized = sanitized.replace(NOSTR_KEY_REGEX, (match) => {
    const id = `[NOSTR_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 9. Redact Silent Payment Addresses (sp1...)
  sanitized = sanitized.replace(SP_ADDR_REGEX, (match) => {
    const id = `[SP_ADDR_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 10. Redact Bitcoin WIF Private Keys (Mainnet & Testnet)
  sanitized = sanitized.replace(WIF_KEY_REGEX, (match) => {
    const id = `[WIF_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 11. Redact Lightning BOLT11 Invoices
  sanitized = sanitized.replace(BOLT11_REGEX, (match) => {
    const id = `[BOLT11_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 12. Redact AI Service API Keys (Google Gemini, OpenAI, etc.)
  sanitized = sanitized.replace(API_KEY_REGEX, (match) => {
    const id = `[API_KEY_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    return id;
  });

  // 13. Redact mashed mnemonics (last pass to avoid over-matching technical identifiers)
  sanitized = sanitized.replace(MASHED_MNEMONIC_REGEX, (match) => {
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
