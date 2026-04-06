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
  const reversedMap: Record<string, string> = {};

  const normalized = text.replace(NORMALIZE_REGEX, "");
  let sanitized = normalized;

  const redact = (regex: RegExp, label: string) => {
    sanitized = sanitized.replace(regex, (match) => {
      // Deduplicate: If we've already redacted this specific secret, reuse the ID
      if (reversedMap[match]) return reversedMap[match];

      const id = `[${label}_${generateRandomString(4)}]`;
      redactionMap[id] = match;
      reversedMap[match] = id;
      return id;
    });
  };

  // 1. Redact BIP-39 Mnemonics (12-24 words)
  redact(MNEMONIC_REGEX, "MNEMONIC");

  // 2. Redact Bitcoin Addresses (Legacy, Segwit, Taproot, Testnet)
  redact(BTC_ADDR_REGEX, "BTC_ADDR");

  // 3. Redact EVM Addresses (0x...)
  redact(EVM_ADDR_REGEX, "EVM_ADDR");

  // 4. Redact Transaction IDs / Private Keys / Node IDs / 64-byte Seeds (64, 66, or 128-char hex)
  redact(HEX_SECRET_REGEX, "HEX_SEC");

  // 5. Redact Stacks Addresses (SP..., ST...)
  redact(STX_ADDR_REGEX, "STX_ADDR");

  // 6. Redact Liquid Addresses (lq1..., tlq1..., elq1...)
  redact(LIQUID_ADDR_REGEX, "LIQUID_ADDR");

  // 7. Redact BIP32 Extended Keys (xpub/xprv etc)
  redact(EXT_KEY_REGEX, "EXT_KEY");

  // 8. Redact Nostr Keys (nsec1, npub1)
  redact(NOSTR_KEY_REGEX, "NOSTR_KEY");

  // 9. Redact Silent Payment Addresses (sp1...)
  redact(SP_ADDR_REGEX, "SP_ADDR");

  // 10. Redact Bitcoin WIF Private Keys (Mainnet & Testnet)
  redact(WIF_KEY_REGEX, "WIF_KEY");

  // 11. Redact Lightning BOLT11 Invoices
  redact(BOLT11_REGEX, "BOLT11");

  // 12. Redact AI Service API Keys (Google Gemini, OpenAI, etc.)
  redact(API_KEY_REGEX, "API_KEY");

  // 13. Redact mashed mnemonics (last pass to avoid over-matching technical identifiers)
  sanitized = sanitized.replace(MASHED_MNEMONIC_REGEX, (match) => {
    // Only redact if it doesn't look like a redaction placeholder
    if (match.startsWith('[') && match.includes('_') && match.endsWith(']')) return match;

    if (reversedMap[match]) return reversedMap[match];

    const id = `[MNEMONIC_${generateRandomString(4)}]`;
    redactionMap[id] = match;
    reversedMap[match] = id;
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
