import { describe, it, expect } from "vitest";
import { sanitizePrompt } from "../services/ai-security";
import { sanitizeError } from "../services/network";

describe("Sentinel: Leak Detection Repro", () => {
  describe("AI Sanitization", () => {
    it("should redact Nostr nsec keys (CURRENTLY LEAKS)", () => {
      const nsec = "nsec1vl66q2h7p6lkkgv8pnv564g088p8v9pxxpxxpxxpxxpxxpxxpxxpxxpxxp";
      const prompt = `My Nostr key is ${nsec}`;
      const { sanitized } = sanitizePrompt(prompt);
      // If it doesn't contain [NOSTR_KEY_ or similar, it leaked
      expect(sanitized).not.toContain(nsec);
    });

    it("should redact Nostr npub keys (CURRENTLY LEAKS)", () => {
      const npub = "npub1vl66q2h7p6lkkgv8pnv564g088p8v9pxxpxxpxxpxxpxxpxxpxxpxxpxxp";
      const prompt = `My Nostr pubkey is ${npub}`;
      const { sanitized } = sanitizePrompt(prompt);
      expect(sanitized).not.toContain(npub);
    });

    it("should redact Silent Payment addresses (CURRENTLY LEAKS)", () => {
      const spAddr = "sp1qvl66q2h7p6lkkgv8pnv564g088p8v9pxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxp";
      const prompt = `Send to ${spAddr}`;
      const { sanitized } = sanitizePrompt(prompt);
      expect(sanitized).not.toContain(spAddr);
    });
  });

  describe("Error Sanitization", () => {
    it("should redact Nostr keys in errors (CURRENTLY LEAKS)", () => {
      const nsec = "nsec1vl66q2h7p6lkkgv8pnv564g088p8v9pxxpxxpxxpxxpxxpxxpxxpxxpxxp";
      const errorMsg = `Failed with key ${nsec}`;
      expect(sanitizeError(errorMsg)).toBe("Protocol Error");
    });

    it("should redact Silent Payment addresses in errors (CURRENTLY LEAKS)", () => {
      const spAddr = "sp1qvl66q2h7p6lkkgv8pnv564g088p8v9pxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxpxxp";
      const errorMsg = `Invalid address ${spAddr}`;
      expect(sanitizeError(errorMsg)).toBe("Protocol Error");
    });
  });
});
