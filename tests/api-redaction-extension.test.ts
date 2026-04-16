import { describe, it, expect } from "vitest";
import { sanitizeError } from "../services/network";

describe("Expanded API Key Redaction", () => {
  it("should redact Stripe live and test keys", () => {
    const liveKey = ["sk", "_live_"].join("") + "5".repeat(20);
    const testKey = ["sk", "_test_"].join("") + "t".repeat(20);

    expect(sanitizeError("Failed with " + liveKey)).toBe("Protocol Error");
    expect(sanitizeError("Failed with " + testKey)).toBe("Protocol Error");
  });

  it("should redact GitHub classic and fine-grained tokens", () => {
    const classicToken = ["ghp", "_"].join("") + "g".repeat(36);
    const pat = ["github", "_pat_"].join("") + "p".repeat(80);

    expect(sanitizeError("Failed with " + classicToken)).toBe("Protocol Error");
    expect(sanitizeError("Failed with " + pat)).toBe("Protocol Error");
  });

  it("should redact AWS access key IDs", () => {
    const awsKey = ["AK", "IA"].join("") + "A".repeat(16);
    expect(sanitizeError("Failed with " + awsKey)).toBe("Protocol Error");
  });
});
