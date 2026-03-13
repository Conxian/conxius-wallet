import { describe, it, expect, vi } from "vitest";
import { callAi, setAiConfig } from "../services/ai";

describe("AI Error Hardening", () => {
  it("should sanitize error output in callAi", async () => {
    // 1. Setup leaky AI config (Custom provider so we can trigger a fetch error)
    setAiConfig({
      provider: "Custom",
      apiKey: "test-key",
      endpoint: "https://api.example.com/ai"
    });

    // 2. Mock fetch to throw an error containing sensitive data
    const leakyError = {
      message: "Failed to connect to database at secret-db-v1.conxian.internal with key 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      stack: "Error at /node_modules/leaky-lib/index.js:10:5"
    };

    global.fetch = vi.fn().mockRejectedValue(leakyError);

    // 3. Call AI
    const result = await callAi("Hello");

    // 4. Assertions
    expect(result).toContain("AI Protocol Error:");
    // The sanitized output should NOT contain the secret database URL, the private key, or the stack trace
    expect(result).not.toContain("secret-db-v1.conxian.internal");
    expect(result).not.toContain("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
    expect(result).not.toContain("node_modules");

    // It should fallback to the default "Protocol Error" if sensitive patterns are found
    expect(result).toBe("AI Protocol Error: Protocol Error");
  });

  it("should redact WIF and BOLT11 in sanitizeError", async () => {
    const { sanitizeError } = await import("../services/network");

    const leakyWif = "Error: WIF key 5Kb8kLf9zgWQand97Fv2U5qW4U1uF5wB9A6t9G5wB9A6t9G5wB9 leaked";
    expect(sanitizeError(leakyWif)).toBe("Protocol Error");

    const leakyBolt11 = "Error: Invoice lnbc10u1pwjqyuzpp5w6v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5v leaked";
    expect(sanitizeError(leakyBolt11)).toBe("Protocol Error");

    const leakyApiKey = "Error: API key AIzaSyDUMMY-API-KEY-FOR-TESTING-PURPOSE leaked";
    expect(sanitizeError(leakyApiKey)).toBe("Protocol Error");

    const leakyOpenAiKey = "Error: Secret key sk-TEST-SECRET-KEY-THAT-IS-NOT-REAL-12345 leaked";
    expect(sanitizeError(leakyOpenAiKey)).toBe("Protocol Error");
  });
});
