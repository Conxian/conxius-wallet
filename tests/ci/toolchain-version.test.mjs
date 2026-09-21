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
    expect(pnpmVersion).toBe('11.13.0');
  });

  it('detects pnpm version from user agent env', () => {
    const env = { npm_config_user_agent: 'pnpm/11.13.0 npm/? node/v22.22.1 linux x64' };
    const detected = detectPnpmVersion(env);
    expect(detected).toBe('11.13.0');
  });

  it('detects pnpm version from PNPM_VERSION env', () => {
    const env = { PNPM_VERSION: '11.13.0' };
    const detected = detectPnpmVersion(env);
    expect(detected).toBe('11.13.0');
  });

  it('passes validation when Node is 22.x and pnpm is 11.13.0', () => {
    const result = validateToolchainVersion({
      nodeVersion: 'v22.22.1',
      expectedPnpm: '11.13.0',
      actualPnpm: '11.13.0',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.nodeMajor).toBe('22');
    expect(result.actualPnpm).toBe('11.13.0');
  });

  it('fails validation when Node major is not 22', () => {
    const result = validateToolchainVersion({
      nodeVersion: 'v24.2.0',
      expectedPnpm: '11.13.0',
      actualPnpm: '11.13.0',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Node.js version mismatch: expected 22.x, got v24.2.0');
  });

  it('fails validation when pnpm version is mismatched', () => {
    const result = validateToolchainVersion({
      nodeVersion: 'v22.14.0',
      expectedPnpm: '11.13.0',
      actualPnpm: '10.28.1',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('pnpm version mismatch: expected 11.13.0, got 10.28.1');
  });

  it('fails validation when pnpm version cannot be detected', () => {
    const result = validateToolchainVersion({
      nodeVersion: 'v22.14.0',
      expectedPnpm: '11.13.0',
      actualPnpm: null,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('unable to detect pnpm version');
  });

  it('runToolchainVersionCheck throws an Error on failure', () => {
    expect(() =>
      runToolchainVersionCheck({
        nodeVersion: 'v20.10.0',
        expectedPnpm: '11.13.0',
        actualPnpm: '11.13.0',
      }),
    ).toThrowError(/Strict Toolchain Version Check Failed/);
  });

  it('runToolchainVersionCheck returns success message on pass', () => {
    const message = runToolchainVersionCheck({
      nodeVersion: 'v22.22.1',
      expectedPnpm: '11.13.0',
      actualPnpm: '11.13.0',
    });
    expect(message).toContain('Toolchain version check passed');
  });
});
