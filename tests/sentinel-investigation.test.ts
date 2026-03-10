import { describe, it, expect } from "vitest";
import { sanitizePrompt } from "../services/ai-security";

describe("Sentinel Investigation: AI Security Bypasses", () => {
  it("should redact XPUB (uppercase)", () => {
    const prompt = "My key is XPUB661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybG6SSJ9P11fSjR4Bv8UJiTqK6VHHj19eLhE5XgYp99g";
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[EXT_KEY_");
    expect(sanitized).not.toContain("XPUB661");
  });

  it("should redact 0X hex prefix (uppercase X)", () => {
    const prompt = "My secret is 0X1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[HEX_SEC_");
    expect(sanitized).not.toContain("0X1234567890abcdef");
  });

  it("should redact EVM addresses with 0X prefix", () => {
    const prompt = "My wallet is 0X71C7656EC7ab88b098defB751B7401B5f6d8976F";
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[EVM_ADDR_");
    expect(sanitized).not.toContain("0X71C7656EC7ab88b098defB751B7401B5f6d8976F");
  });
});
