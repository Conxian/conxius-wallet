import { describe, expect, it } from 'vitest';
import {
  readInstalledPackageMetadata,
  readInstalledTypeScriptCompatibility,
  satisfiesVersionRange,
  validateTypeScriptCompatibility,
} from '../../scripts/ci/check_typescript_compatibility.mjs';

const supportedTypescriptEslint = {
  version: '8.65.0',
  peerDependencies: { typescript: '>=4.8.4 <6.1.0' },
};

describe('TypeScript and typescript-eslint compatibility guard', () => {
  it('accepts a TypeScript version inside the installed peer range', () => {
    expect(
      validateTypeScriptCompatibility({
        typescript: { version: '6.0.3' },
        typescriptEslint: supportedTypescriptEslint,
      }),
    ).toEqual({
      typescriptVersion: '6.0.3',
      typescriptEslintVersion: '8.65.0',
      supportedRange: '>=4.8.4 <6.1.0',
    });
  });

  it('rejects an unsupported TypeScript version with actionable output', () => {
    expect(() =>
      validateTypeScriptCompatibility({
        typescript: { version: '7.0.2' },
        typescriptEslint: supportedTypescriptEslint,
      }),
    ).toThrow(
      /installed TypeScript: 7\.0\.2[\s\S]*typescript-eslint: 8\.65\.0[\s\S]*supported TypeScript range: >=4\.8\.4 <6\.1\.0[\s\S]*remediation:/,
    );
  });

  it('fails closed when package metadata uses unsupported range syntax', () => {
    expect(() =>
      validateTypeScriptCompatibility({
        typescript: { version: '6.0.3' },
        typescriptEslint: {
          version: '9.0.0',
          peerDependencies: { typescript: 'workspace:*' },
        },
      }),
    ).toThrow(/cannot evaluate installed typescript-eslint metadata[\s\S]*not valid npm semver syntax[\s\S]*workspace:\*/);
  });

  it('supports standard npm semver comparator, caret, tilde, partial, x-range, and OR syntax', () => {
    expect(satisfiesVersionRange('6.0.3', '>=4.8.4 <6.1.0')).toBe(true);
    expect(satisfiesVersionRange('6.0.3', '^6.0.0')).toBe(true);
    expect(satisfiesVersionRange('6.0.3', '~6.0.0')).toBe(true);
    expect(satisfiesVersionRange('6.2.4', '6.x')).toBe(true);
    expect(satisfiesVersionRange('6.0.3', '6')).toBe(true);
    expect(satisfiesVersionRange('7.0.0', '<6.0.0 || >=6.0.3 <7.0.0')).toBe(false);
    expect(satisfiesVersionRange('6.0.3', '<6.0.0 || >=6.0.3 <7.0.0')).toBe(true);
  });

  it('uses npm semver prerelease behavior', () => {
    expect(satisfiesVersionRange('6.0.3-beta.1', '^6.0.0')).toBe(false);
    expect(satisfiesVersionRange('6.0.3-beta.1', '>=6.0.3-beta.1 <6.1.0')).toBe(true);
  });

  it('rejects an invalid npm range even when another alternative would match', () => {
    expect(() => satisfiesVersionRange('6.0.3', '>=4.8.4 <6.1.0 || workspace:*')).toThrow(
      /not valid npm semver syntax[\s\S]*workspace:\*/,
    );
  });

  it('evaluates supported comparator alternatives without a repository-owned range constant', () => {
    expect(satisfiesVersionRange('6.0.3', '<6.0.0 || >=6.0.3 <7.0.0')).toBe(true);
    expect(satisfiesVersionRange('7.0.2', '<6.0.0 || >=6.0.3 <7.0.0')).toBe(false);
  });

  it('resolves package metadata through pnpm package exports', () => {
    expect(readInstalledPackageMetadata('typescript')).toEqual(
      expect.objectContaining({ version: expect.any(String) }),
    );
    expect(readInstalledPackageMetadata('typescript-eslint')).toEqual(
      expect.objectContaining({ version: expect.any(String), peerDependencies: expect.any(Object) }),
    );
  });

  it('validates the repository-installed TypeScript and typescript-eslint pair', () => {
    const installed = readInstalledTypeScriptCompatibility();

    expect(validateTypeScriptCompatibility(installed)).toEqual({
      typescriptVersion: installed.typescript.version,
      typescriptEslintVersion: installed.typescriptEslint.version,
      supportedRange: installed.typescriptEslint.peerDependencies.typescript,
    });
  });
});
