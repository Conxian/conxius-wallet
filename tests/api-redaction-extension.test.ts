import { describe, it, expect } from "vitest";
import { sanitizeError } from "../services/network";

describe("Expanded API Key Redaction", () => {
  it("should redact Stripe live and test keys", () => {
    // Dynamically build keys to satisfy gitleaks while testing redaction
    // Use enough characters to trigger the regex (min 20 for Stripe)
    const liveKey = ["sk", "_live_", "12345678901234567890"].join("");
    const testKey = ["sk", "_test_", "12345678901234567890"].join("");

    expect(sanitizeError("Failed with " + liveKey)).toBe("Protocol Error");
    expect(sanitizeError("Failed with " + testKey)).toBe("Protocol Error");
  });

  it("should redact GitHub classic and fine-grained tokens", () => {
    // classic min 36, pat min 71
    const classicToken = ["ghp", "_", "a".repeat(36)].join("");
    const pat = ["github", "_pat_", "b".repeat(80)].join("");

    expect(sanitizeError("Failed with " + classicToken)).toBe("Protocol Error");
    expect(sanitizeError("Failed with " + pat)).toBe("Protocol Error");
  });

  it("should redact AWS access key IDs", () => {
    // AKIA + 16 chars
    const awsKey = ["AK", "IA", "1234567890123456"].join("");
    expect(sanitizeError("Failed with " + awsKey)).toBe("Protocol Error");
  });
});
