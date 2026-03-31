import { describe, it, expect } from "vitest";
import { sanitizePrompt } from "../services/ai-security";
import { sanitizeError } from "../services/network";

describe("AI Security: Extended API Key Redaction", () => {
  it("should redact Stripe live keys", () => {
    const prompt = "My Stripe key is sk_live_51P3mABC123def456GHI789";
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[API_KEY_");
    expect(sanitized).not.toContain("sk_live_51P3mABC123def456GHI789");
  });

  it("should redact Stripe test keys", () => {
    const prompt = "Test key: sk_test_51P3mABC123def456GHI789";
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[API_KEY_");
    expect(sanitized).not.toContain("sk_test_51P3mABC123def456GHI789");
  });

  it("should redact GitHub Fine-grained PATs", () => {
    const pat = "github_pat_11ABC1230x000000000000000000000000000000000000000000000000000000000000000000000000";
    const prompt = `My PAT is ${pat}`;
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[API_KEY_");
    expect(sanitized).not.toContain(pat);
  });

  it("should redact GitHub Classic PATs", () => {
    const prompt = "Classic key: ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD";
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[API_KEY_");
    expect(sanitized).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD");
  });

  it("should redact AWS Access Key IDs", () => {
    const prompt = "AWS ID: AKIAIOSFODNN7EXAMPLE";
    const { sanitized } = sanitizePrompt(prompt);
    expect(sanitized).toContain("[API_KEY_");
    expect(sanitized).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("should sanitize errors containing new API key formats", () => {
    const errorMsg = "Unauthorized access with key sk_live_51P3mABC123def456GHI789";
    const sanitized = sanitizeError(errorMsg);
    expect(sanitized).toBe("Protocol Error");
  });
});
