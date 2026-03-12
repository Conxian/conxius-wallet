import { describe, it, expect } from "vitest";
import { sanitizeError } from "../services/network";

describe("sanitizeError Circular Reference Hardening", () => {
  it("should detect sensitive data even with circular references", () => {
    const sensitiveData = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const leakyError: any = {
      message: "Something went wrong",
      data: {
        key: sensitiveData
      }
    };
    // Create circular reference
    leakyError.self = leakyError;

    // Currently, JSON.stringify(leakyError) will throw,
    // and it will fall back to String(leakyError) which is "[object Object]"
    // and thus it will NOT find the sensitiveData.

    const result = sanitizeError(leakyError);
    expect(result).toBe("Protocol Error");
  });

  it("should align Bitcoin bech32 length with ai-security (minimum 37)", () => {
    // bc1q followed by 33 chars = 37 total.
    // The current regex in network.ts uses {38,58}
    const shortBech32 = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfj"; // 36 chars - should NOT match
    const minBech32 = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjh"; // 37 chars - SHOULD match

    expect(sanitizeError(`Leaked: ${minBech32}`)).toBe("Protocol Error");
  });
});
