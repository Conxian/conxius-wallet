import { describe, it, expect } from "vitest";
import { sanitizeError } from "../services/network";

describe("sanitizeError Circular Reference Hardening", () => {
  it("should detect sensitive data even with circular references", () => {
    const sensitiveData = "0x" + "1234567890" + "a".repeat(54);
    const leakyError: any = {
      message: "Something went wrong",
      data: {
        key: sensitiveData
      }
    };
    // Create circular reference
    leakyError.self = leakyError;

    const result = sanitizeError(leakyError);
    expect(result).toBe("Protocol Error");
  });

  it("should align Bitcoin bech32 length with ai-security (minimum 37)", () => {
    // bc1q followed by 33 chars = 37 total.
    const minBech32 = "bc1q" + "x".repeat(33);

    expect(sanitizeError(`Leaked: ${minBech32}`)).toBe("Protocol Error");
  });
});
