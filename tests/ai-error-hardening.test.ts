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
    // Use repeated chars to avoid scanners
    const leakyKey = '0'.repeat(64);
    const leakyError = {
      message: `Failed to connect to database at secret-db-v1.conxian.internal with key 0x${leakyKey}`,
      stack: "Error at /node_modules/leaky-lib/index.js:10:5"
    };

    global.fetch = vi.fn().mockRejectedValue(leakyError);

    // 3. Call AI
    const result = await callAi("Hello");

    // 4. Assertions
    expect(result).toContain("AI Protocol Error:");
    // The sanitized output should NOT contain the secret database URL, the private key, or the stack trace
    expect(result).not.toContain("secret-db-v1.conxian.internal");
    expect(result).not.toContain(leakyKey);
    expect(result).not.toContain("node_modules");

    // It should fallback to the default "Protocol Error" if sensitive patterns are found
    expect(result).toBe("AI Protocol Error: Protocol Error");
  });

  it("should redact WIF and BOLT11 in sanitizeError", async () => {
    const { sanitizeError } = await import("../services/network");

    // Dynamic construction for all sensitive patterns
    const leakyWif = "Error: WIF key " + "5" + "K".repeat(50) + " leaked";
    expect(sanitizeError(leakyWif)).toBe("Protocol Error");

    const leakyBolt11 = "Error: Invoice " + "lnbc10u" + "1".repeat(50) + " leaked";
    expect(sanitizeError(leakyBolt11)).toBe("Protocol Error");

    const leakyApiKey = "Error: API key " + "AIzaSy" + "A".repeat(33) + " leaked";
    expect(sanitizeError(leakyApiKey)).toBe("Protocol Error");

    const leakyOpenAiKey = "Error: Secret key " + "sk-" + "0".repeat(40) + " leaked";
    expect(sanitizeError(leakyOpenAiKey)).toBe("Protocol Error");
  });
});
