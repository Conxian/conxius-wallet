import { describe, expect, it } from 'vitest';
import {
  detectPnpmVersion,
  getExpectedPnpmVersion,
  runToolchainVersionCheck,
  validateToolchainVersion,
} from '../../scripts/ci/check_toolchain_version.mjs';

describe('Toolchain Version Check', () => {
  it('detects expected pnpm version from package.json', () => {
    const pnpmVersion = getExpectedPnpmVersion();
    expect(pnpmVersion).toBe('12.21.0');
  });

  it('detects pnpm version from user agent env', () => {
    const env = { npm_config_user_agent: 'pnpm/12.21.0 npm/? node/v25.5.0 linux x64' };
    const detected = detectPnpmVersion(env);
    expect(detected).toBe('12.21.0');
  });

  it('detects pnpm version from PNPM_VERSION env', () => {
    const env = { PNPM_VERSION: '12.21.0' };
    const detected = detectPnpmVersion(env);
    expect(detected).toBe('12.21.0');
  });

  it('passes validation when Node is 26.x and pnpm is 12.21.0', () => {
    const result = validateToolchainVersion({
      nodeVersion: 'v26.13.1',
      expectedPnpm: '12.21.0',
      actualPnpm: '12.21.0',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.nodeMajor).toBe('26');
    expect(result.actualPnpm).toBe('12.21.0');
  });

  it('fails validation when Node major is below 26', () => {
    const result = validateToolchainVersion({
      nodeVersion: 'v25.5.0',
      expectedPnpm: '12.21.0',
      actualPnpm: '12.21.0',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Node.js version mismatch: expected 26.x or higher, got v25.5.0');
  });

  it('fails validation when pnpm version is mismatched', () => {
    const result = validateToolchainVersion({
      nodeVersion: 'v26.13.1',
      expectedPnpm: '12.21.0',
      actualPnpm: '10.28.1',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('pnpm version mismatch: expected 12.21.0, got 10.28.1');
  });

  it('fails validation when pnpm version cannot be detected', () => {
    const result = validateToolchainVersion({
      nodeVersion: 'v26.13.1',
      expectedPnpm: '12.21.0',
      actualPnpm: null,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('unable to detect pnpm version');
  });

  it('runToolchainVersionCheck throws an Error on failure', () => {
    expect(() =>
      runToolchainVersionCheck({
        nodeVersion: 'v20.10.0',
        expectedPnpm: '12.21.0',
        actualPnpm: '12.21.0',
      }),
    ).toThrowError(/Strict Toolchain Version Check Failed/);
  });

  it('runToolchainVersionCheck returns success message on pass', () => {
    const message = runToolchainVersionCheck({
      nodeVersion: 'v26.13.1',
      expectedPnpm: '12.21.0',
      actualPnpm: '12.21.0',
    });
    expect(message).toContain('Toolchain version check passed');
  });
});
