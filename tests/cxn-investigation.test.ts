import { describe, it, expect } from "vitest";
import { sanitizePrompt } from "../services/ai-security";

describe("CXN Security Investigation", () => {
  it("should catch secrets that follow specific keywords", () => {
    // Dynamic construction
    const secret = "f".repeat(64);
    const prompt = "Secret hex: " + secret;
    const { sanitized } = sanitizePrompt(prompt);

    expect(sanitized).not.toContain(secret);
    expect(sanitized).toContain("[HEX_SEC_");
  });
});
