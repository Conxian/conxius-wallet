import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_TOOLCHAIN,
  runToolchainGuard,
} from '../../scripts/ci/check_typescript_toolchain.mjs';
import {
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

function packageFixture() {
  return {
    scripts: {
      typecheck: EXPECTED_TOOLCHAIN.typecheckScript,
      'typecheck:ts6': EXPECTED_TOOLCHAIN.typecheckTs6Script,
      'typecheck:ts7': EXPECTED_TOOLCHAIN.typecheckTs7Script,
      build: EXPECTED_TOOLCHAIN.buildScript,
    },
    devDependencies: {
      '@typescript/native': EXPECTED_TOOLCHAIN.nativeAlias,
      typescript: EXPECTED_TOOLCHAIN.typescriptAlias,
      'typescript-eslint': '8.65.0',
    },
  };
}

function lockfileFixture() {
  return `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      '@typescript/native':
        specifier: ${EXPECTED_TOOLCHAIN.nativeAlias}
        version: typescript@${EXPECTED_TOOLCHAIN.nativeVersion}
      typescript:
        specifier: ${EXPECTED_TOOLCHAIN.typescriptAlias}
        version: '@typescript/typescript6@${EXPECTED_TOOLCHAIN.typescriptVersion}'

packages:
  '@typescript/typescript6@${EXPECTED_TOOLCHAIN.typescriptVersion}':
    resolution: {integrity: fixture}
  typescript@${EXPECTED_TOOLCHAIN.nativeVersion}:
    resolution: {integrity: fixture}

snapshots:
`;
}

function validateFixture({ packageOverride, lockfile = lockfileFixture(), compilerVersions } = {}) {
  return validateTypeScriptCompatibility({
    packageJson: packageOverride ?? packageFixture(),
    lockfile,
    compilerVersions: compilerVersions ?? {
      ts6: EXPECTED_TOOLCHAIN.ts6ReportedVersion,
      ts7: EXPECTED_TOOLCHAIN.ts7ReportedVersion,
    },
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
  const packageOverride = packageFixture();
  packageOverride.devDependencies.typescript = typescriptVersion;
  writeFileSync(join(root, 'package.json'), JSON.stringify(packageOverride));
  const lockfile = lockfileFixture().replace(
    `specifier: ${EXPECTED_TOOLCHAIN.typescriptAlias}\n        version: '@typescript/typescript6@${EXPECTED_TOOLCHAIN.typescriptVersion}'`,
    `specifier: ${typescriptVersion}\n        version: typescript@${typescriptVersion}`,
  );
  writeFileSync(join(root, 'pnpm-lock.yaml'), lockfile);

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

describe('TypeScript compatibility guard delegation', () => {
  it('accepts the approved dual-toolchain contract through the compatibility API', () => {
    expect(validateFixture()).toEqual([]);
  });

  it('rejects a TypeScript 7 promotion under the package name typescript', () => {
    const candidate = packageFixture();
    candidate.devDependencies.typescript = '7.0.2';

    const errors = validateFixture({ packageOverride: candidate });
    expect(errors).toContain('typescript must be exactly npm:@typescript/typescript6@6.0.2, found 7.0.2');
    expect(errors).toContain('typescript must not resolve directly to TypeScript 7; TypeScript 7 belongs under @typescript/native');
  });

  it('rejects reported compiler-version drift', () => {
    const errors = validateFixture({
      compilerVersions: { ts6: '6.0.2', ts7: '7.0.3' },
    });

    expect(errors).toContain('tsc6 must report 6.0.3, found 6.0.2');
    expect(errors).toContain('tsc must report 7.0.2, found 7.0.3');
  });

  it('prints the migration action and delegation scope when the compatibility CLI fails', () => {
    expect(() => runTypeScriptCompatibilityCheck(createRepositoryFixture())).toThrow(
      new RegExp(`separately guarded lane for ${MIGRATION_ISSUE}`),
    );
    expect(() => runTypeScriptCompatibilityCheck(createRepositoryFixture())).toThrow(
      /compatibility alias delegates to the repository-owned dual-toolchain contract/,
    );
  });

  it('keeps the compatibility alias and explicit toolchain guard available in scripts and CI', () => {
    expect(packageJson.scripts['check:typescript-compat']).toBe(
      'node scripts/ci/check_typescript_compatibility.mjs',
    );
    expect(packageJson.scripts.lint).toContain('pnpm run check:typescript-toolchain');
    expect(packageJson.scripts.typecheck).toContain('pnpm run check:typescript-toolchain');
    expect(packageJson.scripts.build).toContain('pnpm run check:typescript-toolchain');
    expect(workflow).toContain('run: pnpm run check:typescript-toolchain');
    expect(releaseWorkflow).toContain('run: pnpm run check:typescript-toolchain');
  });

  it('preserves the authoritative guard result for the checked-out repository', () => {
    expect(runToolchainGuard(repositoryRoot).errors).toEqual([]);
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
