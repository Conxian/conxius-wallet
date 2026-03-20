import { describe, it, expect } from "vitest";
import { sanitizePrompt } from "../services/ai-security";

describe("Sentinel Investigation: Mnemonic Redaction Gaps", () => {
  it("should redact mashed 12-word mnemonics (baseline)", () => {
    const mashed = "abandonabilityableaboutaboveabsentabsorbabstractabsurdabuseaccessaccident";
    const { sanitized } = sanitizePrompt(mashed);
    expect(sanitized).toContain("[MNEMONIC_");
  });

  it("should redact mashed 24-word mnemonics", () => {
    const word = "abandon";
    const mashed24 = word.repeat(24);
    const { sanitized } = sanitizePrompt(mashed24);
    // If vulnerable, this will FAIL or only partially redact.
    expect(sanitized).toContain("[MNEMONIC_");
    expect(sanitized).not.toContain(word);
  });

  it("should redact mashed 13-word mnemonics", () => {
    const word = "abandon";
    const mashed13 = word.repeat(13);
    const { sanitized } = sanitizePrompt(mashed13);
    // If vulnerable, this will FAIL because lookahead sees the 13th word.
    expect(sanitized).toContain("[MNEMONIC_");
    expect(sanitized).not.toContain(word);
  });

  it("should redact 64-byte (128-char) hex seeds (alphabetic)", () => {
    const hexSeed = "a".repeat(128);
    const { sanitized } = sanitizePrompt(hexSeed);
    // Currently misidentified as MNEMONIC because it's all letters
    expect(sanitized).toMatch(/\[(HEX_SEC|MNEMONIC)_/);
  });

  it("should redact 64-byte (128-char) hex seeds (numeric)", () => {
    const hexSeed = "1".repeat(128);
    const { sanitized } = sanitizePrompt(hexSeed);
    // If vulnerable, this will FAIL because it's not [a-z] and hexRegex is only 64-66
    expect(sanitized).toContain("[HEX_SEC_");
  });

  it("should redact 64-byte (128-char) hex seeds with 0x prefix", () => {
    const hexSeed = "0x" + "1".repeat(128);
    const { sanitized } = sanitizePrompt(hexSeed);
    // If vulnerable, this will FAIL.
    expect(sanitized).toContain("[HEX_SEC_");
    expect(sanitized).not.toContain("1111");
  });
});
