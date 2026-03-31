import { describe, it, expect } from "vitest";
import { sanitizeError } from "../services/network";

describe("Expanded API Key Redaction", () => {
  it("should redact Stripe live and test keys", () => {
    const liveKey = "sk_live_" + "5".repeat(20);
    const testKey = "sk_test_" + "t".repeat(20);

    expect(sanitizeError(`Failed with ${liveKey}`)).toBe("Protocol Error");
    expect(sanitizeError(`Failed with ${testKey}`)).toBe("Protocol Error");
  });

  it("should redact GitHub classic and fine-grained tokens", () => {
    const classicToken = "ghp_" + "g".repeat(36);
    const pat = "github_pat_" + "p".repeat(80);

    expect(sanitizeError(`Failed with ${classicToken}`)).toBe("Protocol Error");
    expect(sanitizeError(`Failed with ${pat}`)).toBe("Protocol Error");
  });

  it("should redact AWS access key IDs", () => {
    const awsKey = "AKIA" + "A".repeat(16);
    expect(sanitizeError(`Failed with ${awsKey}`)).toBe("Protocol Error");
  });
});
