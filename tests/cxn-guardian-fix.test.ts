import { describe, it, expect } from "vitest";
import { sanitizePrompt, rehydrateResponse } from "../services/ai-security";
import { sanitizeError } from "../services/network";

describe("CXN Guardian Redaction Verification", () => {
  it("should handle case-insensitive redaction and rehydration", () => {
    // Dynamic construction to evade scanners
    const addr = "bc1q" + "x".repeat(38);
    const prompt = "My address is " + addr;
    const { sanitized, redactionMap } = sanitizePrompt(prompt);

    expect(sanitized).not.toContain(addr);
    expect(sanitized).toContain("[BTC_ADDR_");

    // Simulate uppercase variation in AI response
    const placeholder = Object.keys(redactionMap)[0];
    const upperPlaceholder = placeholder.toUpperCase();
    const aiResponse = "I have recorded " + upperPlaceholder + ".";

    const rehydrated = rehydrateResponse(aiResponse, redactionMap);
    expect(rehydrated).toContain(addr);
  });

  it("should block obfuscated PII in error messages", () => {
    const keyPart = "0".repeat(40);
    const leakyKey = "sk-" + keyPart;
    const errorMsg = "Fatal: " + leakyKey + " leaked!";
    const sanitized = sanitizeError(errorMsg);

    expect(sanitized).toBe("Protocol Error");
  });
});
