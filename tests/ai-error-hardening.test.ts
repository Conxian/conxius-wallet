import { describe, it, expect } from 'vitest';
import { sanitizeError } from '../services/network';

describe('AI Error Sanitization Hardening', () => {
  it('should detect sensitive data in complex error structures', () => {
    const sensitiveAddr = ["bc1q", "x".repeat(38)].join("");
    const complexError = {
      message: 'Failed to process request',
      details: {
        raw: "User address " + sensitiveAddr + " is invalid",
        code: 400
      }
    };

    const sanitized = sanitizeError(complexError);
    expect(sanitized).toBe('Protocol Error');
  });

  it('should handle circular references in error objects', () => {
    const circular: any = { message: 'Circular error' };
    circular.self = circular;

    const sanitized = sanitizeError(circular);
    expect(sanitized).toBe('Circular error');
  });

  it('should redact AI service API keys if they leak in error messages', () => {
    const leakyApiKey = "Error: API key " + ["AI", "zaSy"].join("") + "A".repeat(33) + " leaked";
    expect(sanitizeError(leakyApiKey)).toBe('Protocol Error');

    const leakyOpenAiKey = "Error: Secret key " + ["sk", "-"].join("") + "0".repeat(40) + " leaked";
    expect(sanitizeError(leakyOpenAiKey)).toBe('Protocol Error');
  });
});
