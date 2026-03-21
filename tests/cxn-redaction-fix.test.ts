import { describe, it, expect } from "vitest";
import { sanitizePrompt } from "../services/ai-security";
import { sanitizeError } from "../services/network";

describe("Nakamoto-Guardian: Redaction Boundary Regression Tests", () => {
  it("should redact API keys even when preceded by an underscore", () => {
    const prompt = "The key is api_key_sk-0000000000000000000000000000000000000000";
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[API_KEY_");
    expect(sanitized).not.toContain("sk-0000000000000000000000000000000000000000");
  });

  it("should redact EVM addresses even when preceded by an underscore", () => {
    const prompt = "my_address_0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[EVM_ADDR_");
    expect(sanitized).not.toContain("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
  });

  it("should sanitize errors containing keys with underscores", () => {
    const errorMsg = "Error in field api_key_sk-0000000000000000000000000000000000000000";
    const sanitized = sanitizeError(errorMsg);
    expect(sanitized).toBe("Protocol Error");
  });
});
