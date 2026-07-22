import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPROVED_TYPESCRIPT_BRIDGE_PACKAGE,
  APPROVED_TYPESCRIPT_BRIDGE_SPECIFIER,
  APPROVED_TYPESCRIPT_BRIDGE_VERSION,
  APPROVED_TYPESCRIPT_VERSION,
  MIGRATION_ISSUE,
  readInstalledPackageMetadata,
  readInstalledTypeScriptCompatibility,
  runTypeScriptCompatibilityCheck,
  satisfiesVersionRange,
  validateInstalledTypeScriptCompatibility,
  validateTypeScriptCompatibility,
} from '../../scripts/ci/check_typescript_compatibility.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'));
const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
const releaseWorkflow = readFileSync(resolve(repositoryRoot, '.github/workflows/android-release.yml'), 'utf8');
const temporaryRoots = [];
const supportedTypescriptEslint = {
  version: '8.65.0',
  peerDependencies: { typescript: '>=4.8.4 <6.1.0' },
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function packageFixture(specifier = APPROVED_TYPESCRIPT_BRIDGE_SPECIFIER) {
  return { devDependencies: { typescript: specifier } };
}

function lockfileFixture(
  specifier = APPROVED_TYPESCRIPT_BRIDGE_SPECIFIER,
  version = `${APPROVED_TYPESCRIPT_BRIDGE_PACKAGE}@${APPROVED_TYPESCRIPT_BRIDGE_VERSION}`,
) {
  return `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies:\n      typescript:\n        specifier: ${specifier}\n        version: ${version}\n\npackages:\n  '${APPROVED_TYPESCRIPT_BRIDGE_PACKAGE}@${APPROVED_TYPESCRIPT_BRIDGE_VERSION}':\n    resolution: {integrity: fixture}\n\nsnapshots:\n  '${APPROVED_TYPESCRIPT_BRIDGE_PACKAGE}@${APPROVED_TYPESCRIPT_BRIDGE_VERSION}':\n    dependencies:\n      '@typescript/old': typescript@${APPROVED_TYPESCRIPT_VERSION}\n\n  typescript@${APPROVED_TYPESCRIPT_VERSION}: {}\n`;
}

function validateFixture({ specifier, lockSpecifier, lockVersion, installedTypeScriptVersion } = {}) {
  return validateTypeScriptCompatibility({
    packageJson: packageFixture(specifier),
    lockfile: lockfileFixture(lockSpecifier, lockVersion),
    installedTypeScriptVersion,
  });
}

function createRepositoryFixture({
  typescriptVersion = '7.0.2',
  includeTypescriptEslint = true,
  typescriptEslintVersion = supportedTypescriptEslint.version,
  typescriptPeerRange = supportedTypescriptEslint.peerDependencies.typescript,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'conxius-typescript-compat-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'node_modules/typescript'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ devDependencies: { typescript: typescriptVersion } }),
  );
  writeFileSync(join(root, 'pnpm-lock.yaml'), lockfileFixture(typescriptVersion, typescriptVersion));
  writeFileSync(
    join(root, 'node_modules/typescript/package.json'),
    JSON.stringify({ version: typescriptVersion }),
  );

  if (includeTypescriptEslint) {
    mkdirSync(join(root, 'node_modules/typescript-eslint'), { recursive: true });
    writeFileSync(
      join(root, 'node_modules/typescript-eslint/package.json'),
      JSON.stringify({
        version: typescriptEslintVersion,
        peerDependencies: { typescript: typescriptPeerRange },
      }),
    );
  }

  return root;
}

describe('TypeScript compatibility contract', () => {
  it('accepts the approved TypeScript 6 bridge', () => {
    expect(
      validateFixture({
        specifier: APPROVED_TYPESCRIPT_BRIDGE_SPECIFIER,
        lockSpecifier: APPROVED_TYPESCRIPT_BRIDGE_SPECIFIER,
        lockVersion: `${APPROVED_TYPESCRIPT_BRIDGE_PACKAGE}@${APPROVED_TYPESCRIPT_BRIDGE_VERSION}`,
        installedTypeScriptVersion: APPROVED_TYPESCRIPT_VERSION,
      }),
    ).toEqual([]);
  });

  it('rejects a TypeScript 7 promotion with an actionable migration message', () => {
    const errors = validateFixture({
      specifier: '7.0.2',
      lockSpecifier: '7.0.2',
      lockVersion: '7.0.2',
      installedTypeScriptVersion: '7.0.2',
    });

    expect(errors.join('\n')).toMatch(/above the approved TypeScript major 6/);
    expect(errors.join('\n')).not.toMatch(/typescript-eslint does not support TypeScript 7/);
  });

  it('prints the migration action and contract scope when the CLI guard fails', () => {
    expect(() => runTypeScriptCompatibilityCheck(createRepositoryFixture())).toThrow(
      new RegExp(`${MIGRATION_ISSUE}.*separately validated TypeScript 7 migration`),
    );
    expect(() => runTypeScriptCompatibilityCheck(createRepositoryFixture())).toThrow(
      /approved toolchain contract and validates the installed typescript-eslint peer range/,
    );
  });

  it('rejects lockfile drift even when package.json remains pinned', () => {
    const errors = validateFixture({ lockVersion: '7.0.2' });

    expect(errors.join('\n')).toMatch(/pnpm-lock\.yaml resolves the TypeScript bridge 7\.0\.2/);
  });

  it('rejects an installed compiler that does not match the approved bridge', () => {
    const errors = validateFixture({ installedTypeScriptVersion: '7.0.2' });

    expect(errors.join('\n')).toMatch(/Installed TypeScript is 7\.0\.2/);
  });

  it('wires the guarded package scripts into CI typecheck paths', () => {
    expect(packageJson.scripts['check:typescript-compat']).toBe(
      'node scripts/ci/check_typescript_compatibility.mjs',
    );
    expect(packageJson.scripts.lint).toContain('pnpm run check:typescript-compat');
    expect(packageJson.scripts.typecheck).toContain('pnpm run check:typescript-compat');
    expect(packageJson.scripts.typecheck).toContain('pnpm run typecheck:dual');
    expect(packageJson.scripts.build).toContain('pnpm run check:typescript-compat');
    expect(packageJson.scripts['typecheck:dual']).toContain('pnpm run check:typescript-toolchain');
    expect(workflow).toContain('run: pnpm run typecheck');
    expect(releaseWorkflow).toContain('run: pnpm run typecheck');
  });
});

describe('Installed TypeScript and typescript-eslint compatibility', () => {
  it('accepts a TypeScript version inside the installed peer range', () => {
    expect(
      validateInstalledTypeScriptCompatibility({
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
      validateInstalledTypeScriptCompatibility({
        typescript: { version: '7.0.2' },
        typescriptEslint: supportedTypescriptEslint,
      }),
    ).toThrow(
      /installed TypeScript: 7\.0\.2[\s\S]*typescript-eslint: 8\.65\.0[\s\S]*supported TypeScript range: >=4\.8\.4 <6\.1\.0[\s\S]*remediation:/,
    );
  });

  it('fails closed when package metadata uses unsupported range syntax', () => {
    expect(() =>
      validateInstalledTypeScriptCompatibility({
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
    const result = validateInstalledTypeScriptCompatibility(installed);

    expect(result).toEqual({
      typescriptVersion: installed.typescript.version,
      typescriptEslintVersion: installed.typescriptEslint.version,
      supportedRange: installed.typescriptEslint.peerDependencies.typescript,
    });
  });

  it('fails closed when installed typescript-eslint metadata is unavailable', () => {
    const root = createRepositoryFixture({
      typescriptVersion: APPROVED_TYPESCRIPT_VERSION,
      includeTypescriptEslint: false,
    });

    expect(() => runTypeScriptCompatibilityCheck(root)).toThrow(
      /unable to resolve installed typescript-eslint metadata/,
    );
  });
});
