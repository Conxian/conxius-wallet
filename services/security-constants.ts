/**
 * Centralized security constants for sensitive data redaction and normalization.
 * Consolidates patterns used across AI security and network error sanitization.
 */

// Normalization: Strips non-printable and zero-width characters.
// Excludes common whitespace (0x09, 0x0A, 0x0D) to preserve formatting.
export const NORMALIZE_REGEX = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g;

// BIP-39 Mnemonics (12-24 words) with varied separators.
export const MNEMONIC_REGEX = /(?<![a-zA-Z0-9])(([a-z]{3,}[\s\W_0-9]+){11,23}[a-z]{3,})(?![a-zA-Z0-9])/gi;

// Mashed mnemonics (concatenated words after ZWC stripping).
export const MASHED_MNEMONIC_REGEX = /(?<![a-zA-Z0-9])([a-z]{3,}){12}(?![a-zA-Z0-9])/gi;

// Bitcoin Addresses (Legacy, Segwit, Taproot, Testnet).
export const BTC_ADDR_REGEX = /(?<![a-zA-Z0-9])(bc1[qp][a-z0-9]{33,58}|[13][a-km-zA-NP-Z1-9]{25,39}|tb1[qp][a-z0-9]{33,58}|[mn2][a-km-zA-NP-Z1-9]{25,39})(?![a-zA-Z0-9])/gi;

// EVM Addresses (0x...).
export const EVM_ADDR_REGEX = /(?<![a-zA-Z0-9])(0x[a-fA-F0-9]{40})(?![a-zA-Z0-9])/gi;

// Hex Secrets: TxIDs, Private Keys, Node IDs, 64-byte Seeds (64, 66, or 128-char hex).
export const HEX_SECRET_REGEX = /(?<![a-zA-Z0-9])((?:0x)?(?:[a-fA-F0-9]{64,66}|[a-fA-F0-9]{128}))(?![a-zA-Z0-9])/gi;

// Stacks Addresses (SP..., ST...).
export const STX_ADDR_REGEX = /(?<![a-zA-Z0-9])(S[PST][0-9A-Z]{28,41})(?![a-zA-Z0-9])/gi;

// Liquid Addresses (lq1..., tlq1..., elq1...).
export const LIQUID_ADDR_REGEX = /(?<![a-zA-Z0-9])((?:lq|tlq|elq)1[qp][a-z0-9]{38,110})(?![a-zA-Z0-9])/gi;

// BIP32 Extended Keys (xpub/xprv etc).
export const EXT_KEY_REGEX = /(?<![a-zA-Z0-9])([xtuvyz](?:pub|prv)[1-9A-HJ-NP-Za-km-z]{50,110})(?![a-zA-Z0-9])/gi;

// Nostr Keys (nsec1, npub1).
export const NOSTR_KEY_REGEX = /(?<![a-zA-Z0-9])(nsec1[a-z0-9]{50,200}|npub1[a-z0-9]{50,200})(?![a-zA-Z0-9])/gi;

// Silent Payment Addresses (sp1...).
export const SP_ADDR_REGEX = /(?<![a-zA-Z0-9])(sp1[a-z0-9]{50,200})(?![a-zA-Z0-9])/gi;

// Bitcoin WIF Private Keys.
export const WIF_KEY_REGEX = /(?<![a-zA-Z0-9])([5KL9c][1-9A-HJ-NP-Za-km-z]{50,51})(?![a-zA-Z0-9])/gi;

// Lightning BOLT11 Invoices.
export const BOLT11_REGEX = /(?<![a-zA-Z0-9])(ln(?:bc|tb|bcrt|dev)[0-9a-z]+)(?![a-zA-Z0-9])/gi;

// AI Service API Keys (Google Gemini, OpenAI, GitHub, Stripe, AWS).
export const API_KEY_REGEX = /(?<![a-zA-Z0-9])(AIzaSy[a-zA-Z0-9_-]{33}|sk-[a-zA-Z0-9_-]{20,}|sk_(?:live|test)_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9]{71,90}|ghp_[a-zA-Z0-9]{36,}|AKIA[0-9A-Z]{16})(?![a-zA-Z0-9])/gi;

// System and internal detail patterns for error sanitization.
export const INTERNAL_PATTERNS = [
  /stack/i,
  /at /i,
  /node_modules/i,
  /rpc/i,
  /internal/i,
  /database/i,
  /query/i,
  /__/
];

// Combined list of all sensitive patterns for broad scanning.
export const SENSITIVE_PATTERNS = [
  ...INTERNAL_PATTERNS,
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
  API_KEY_REGEX
];
