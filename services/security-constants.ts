/**
 * Centralized security constants for sensitive data redaction and normalization.
 * Consolidates patterns used across AI security and network error sanitization.
 */

// Normalization: Strips non-printable and zero-width characters.
// Excludes common whitespace (0x09, 0x0A, 0x0D) to preserve formatting.
export const NORMALIZE_REGEX = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g; // eslint-disable-line no-control-regex

// BIP-39 Mnemonics (12-24 words) with varied separators.
const MNEMONIC_PATTERN = "(?<![a-zA-Z0-9])(([a-z]{3,}[\\s\\W_0-9]+){11,23}[a-z]{3,})(?![a-zA-Z0-9])";
export const MNEMONIC_REGEX = new RegExp(MNEMONIC_PATTERN, "gi");
export const MNEMONIC_SCAN = new RegExp(MNEMONIC_PATTERN, "i");

// Mashed mnemonics (concatenated words after ZWC stripping).
const MASHED_MNEMONIC_PATTERN = "(?<![a-zA-Z0-9])([a-z]{3,}){12}(?![a-zA-Z0-9])";
export const MASHED_MNEMONIC_REGEX = new RegExp(MASHED_MNEMONIC_PATTERN, "gi");
export const MASHED_MNEMONIC_SCAN = new RegExp(MASHED_MNEMONIC_PATTERN, "i");

// Bitcoin Addresses (Legacy, Segwit, Taproot, Testnet).
const BTC_ADDR_PATTERN = "(?<![a-zA-Z0-9])(bc1[qp][a-z0-9]{33,58}|[1][a-km-zA-NP-Z1-9]{25,39}|[3][a-km-zA-NP-Z1-9]{25,39}|tb1[qp][a-z0-9]{33,58}|[mn2][a-km-zA-NP-Z1-9]{25,39})(?![a-zA-Z0-9])";
export const BTC_ADDR_REGEX = new RegExp(BTC_ADDR_PATTERN, "gi");
export const BTC_ADDR_SCAN = new RegExp(BTC_ADDR_PATTERN, "i");

// EVM Addresses (0x...).
const EVM_ADDR_PATTERN = "(?<![a-zA-Z0-9])(0x[a-fA-F0-9]{40})(?![a-zA-Z0-9])";
export const EVM_ADDR_REGEX = new RegExp(EVM_ADDR_PATTERN, "gi");
export const EVM_ADDR_SCAN = new RegExp(EVM_ADDR_PATTERN, "i");

// Hex Secrets: TxIDs, Private Keys, Node IDs, 64-byte Seeds (64, 66, or 128-char hex).
const HEX_SECRET_PATTERN = "(?<![a-zA-Z0-9])((?:0x)?(?:[a-fA-F0-9]{64,66}|[a-fA-F0-9]{128}))(?![a-zA-Z0-9])";
export const HEX_SECRET_REGEX = new RegExp(HEX_SECRET_PATTERN, "gi");
export const HEX_SECRET_SCAN = new RegExp(HEX_SECRET_PATTERN, "i");

// Stacks Addresses (SP..., ST...).
const STX_ADDR_PATTERN = "(?<![a-zA-Z0-9])(S[PST][0-9A-Z]{28,41})(?![a-zA-Z0-9])";
export const STX_ADDR_REGEX = new RegExp(STX_ADDR_PATTERN, "gi");
export const STX_ADDR_SCAN = new RegExp(STX_ADDR_PATTERN, "i");

// Liquid Addresses (lq1..., tlq1..., elq1...).
const LIQUID_ADDR_PATTERN = "(?<![a-zA-Z0-9])((?:lq|tlq|elq)1[qp][a-z0-9]{38,110})(?![a-zA-Z0-9])";
export const LIQUID_ADDR_REGEX = new RegExp(LIQUID_ADDR_PATTERN, "gi");
export const LIQUID_ADDR_SCAN = new RegExp(LIQUID_ADDR_PATTERN, "i");

// BIP32 Extended Keys (xpub/xprv etc).
const EXT_KEY_PATTERN = "(?<![a-zA-Z0-9])([xtuvyz](?:pub|prv)[1-9A-HJ-NP-Za-km-z]{50,110})(?![a-zA-Z0-9])";
export const EXT_KEY_REGEX = new RegExp(EXT_KEY_PATTERN, "gi");
export const EXT_KEY_SCAN = new RegExp(EXT_KEY_PATTERN, "i");

// Nostr Keys (nsec1, npub1).
const NOSTR_KEY_PATTERN = "(?<![a-zA-Z0-9])(nsec1[a-z0-9]{50,200}|npub1[a-z0-9]{50,200})(?![a-zA-Z0-9])";
export const NOSTR_KEY_REGEX = new RegExp(NOSTR_KEY_PATTERN, "gi");
export const NOSTR_KEY_SCAN = new RegExp(NOSTR_KEY_PATTERN, "i");

// Silent Payment Addresses (sp1...).
const SP_ADDR_PATTERN = "(?<![a-zA-Z0-9])(sp1[a-z0-9]{50,200})(?![a-zA-Z0-9])";
export const SP_ADDR_REGEX = new RegExp(SP_ADDR_PATTERN, "gi");
export const SP_ADDR_SCAN = new RegExp(SP_ADDR_PATTERN, "i");

// Bitcoin WIF Private Keys.
const WIF_KEY_PATTERN = "(?<![a-zA-Z0-9])([5KL9c][1-9A-HJ-NP-Za-km-z]{50,51})(?![a-zA-Z0-9])";
export const WIF_KEY_REGEX = new RegExp(WIF_KEY_PATTERN, "gi");
export const WIF_KEY_SCAN = new RegExp(WIF_KEY_PATTERN, "i");

// Lightning BOLT11 Invoices.
const BOLT11_PATTERN = "(?<![a-zA-Z0-9])(ln(?:bc|tb|bcrt|dev)[0-9a-z]+)(?![a-zA-Z0-9])";
export const BOLT11_REGEX = new RegExp(BOLT11_PATTERN, "gi");
export const BOLT11_SCAN = new RegExp(BOLT11_PATTERN, "i");

// AI Service API Keys (Google Gemini, OpenAI, GitHub, Stripe, AWS).
const API_KEY_PATTERN = "(?<![a-zA-Z0-9])(AIzaSy[a-zA-Z0-9_-]{33}|sk-[a-zA-Z0-9_-]{20,}|sk_(?:live|test)_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9]{71,90}|ghp_[a-zA-Z0-9]{36,}|AKIA[0-9A-Z]{16})(?![a-zA-Z0-9])";
export const API_KEY_REGEX = new RegExp(API_KEY_PATTERN, "gi");
export const API_KEY_SCAN = new RegExp(API_KEY_PATTERN, "i");

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
// These are the non-global versions to avoid stateful behavior with .test()
export const SENSITIVE_SCAN_PATTERNS = [
  ...INTERNAL_PATTERNS,
  MNEMONIC_SCAN,
  MASHED_MNEMONIC_SCAN,
  BTC_ADDR_SCAN,
  EVM_ADDR_SCAN,
  HEX_SECRET_SCAN,
  STX_ADDR_SCAN,
  LIQUID_ADDR_SCAN,
  EXT_KEY_SCAN,
  NOSTR_KEY_SCAN,
  SP_ADDR_SCAN,
  WIF_KEY_SCAN,
  BOLT11_SCAN,
  API_KEY_SCAN
];

// Combined list of all sensitive patterns for replacement.
export const SENSITIVE_REPLACE_PATTERNS = [
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
