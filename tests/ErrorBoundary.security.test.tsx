/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';
import '@testing-library/jest-dom';

const MnemonicErrorComponent = () => {
  throw new Error('Failed to process mnemonic: abandon ability able about above absent absorb abstract absurd abuse access accident');
};

describe('ErrorBoundary Security', () => {
  it('should redact sensitive info from error messages in the UI', () => {
    // Silence console.error for the expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary scope="Test">
        <MnemonicErrorComponent />
      </ErrorBoundary>
    );

    // Now it should be redacted
    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toContain('abandon ability');
    expect(bodyText).toContain('Protocol Error');

    consoleSpy.mockRestore();
  });
});
