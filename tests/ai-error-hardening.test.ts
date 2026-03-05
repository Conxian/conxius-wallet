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
});
