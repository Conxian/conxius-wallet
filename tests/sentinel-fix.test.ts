import { describe, it, expect } from "vitest";
import {
  sanitizePrompt,
  rehydrateResponse,
} from "../services/ai-security";
import { sanitizeError } from "../services/network";

describe("Sentinel Security Fix: Reproduction Tests", () => {
  it("should redact mnemonics even when words are mashed by ZWC stripping", () => {
    // A 12-word mnemonic with zero-width characters that, when stripped, mashes words together.
    const mnemonic = "abandon\u200Bability\u200Bable\u200Babout\u200Babove\u200Babsent\u200Babsorb\u200Babstract\u200Babsurd\u200Babuse\u200Baccess\u200Baccident";
    const prompt = `My seed is ${mnemonic}`;

    const { sanitized } = sanitizePrompt(prompt);

    // CURRENT EXPECTATION: It should redact it.
    // IF VULNERABLE: It won't find the pattern because words are mashed: "abandonabilityable..."
    expect(sanitized).toContain("[MNEMONIC_");
    expect(sanitized).not.toContain("abandon");
  });

  it("should rehydrate placeholders case-insensitively", () => {
    const prompt = "My address is bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
    const { sanitized, redactionMap } = sanitizePrompt(prompt);

    // Extract the placeholder (e.g., [BTC_ADDR_abcd])
    const placeholder = sanitized.match(/\[BTC_ADDR_[a-z0-9]+\]/)?.[0];
    expect(placeholder).toBeDefined();

    // AI returns the placeholder in uppercase (different from the map's lowercase keys)
    const uppercasePlaceholder = placeholder!.toUpperCase();
    const aiResponse = `The address is ${uppercasePlaceholder}.`;

    const rehydrated = rehydrateResponse(aiResponse, redactionMap);

    // CURRENT EXPECTATION: It should correctly rehydrate even with case mismatch.
    // IF VULNERABLE: It will fail to match and leave the uppercase placeholder.
    expect(rehydrated).toContain("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
    expect(rehydrated).not.toContain(uppercasePlaceholder);
  });

  it("should sanitize errors containing mashed mnemonics", () => {
    // We want to see if it fails if we ONLY check the stripped version.
    // But sanitizeError checks both. Let's see if we can trick it.
    // Actually, if we use a different obfuscator that doesn't get replaced by space?
    // No, ZWC are usually the main concern.

    const mnemonic = "abandon\u200Bability\u200Bable\u200Babout\u200Babove\u200Babsent\u200Babsorb\u200Babstract\u200Babsurd\u200Babuse\u200Baccess\u200Baccident";
    const errorMsg = `Critical failure with seed: ${mnemonic}`;

    const sanitized = sanitizeError(errorMsg);

    // If this passes, it means sanitizeError is already doing a good job with spacedScan.
    // But we should still harden the regex for defense-in-depth.
    expect(sanitized).toBe("Protocol Error");
  });
});
