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
  MIGRATION_ISSUE,
  runTypeScriptCompatibilityCheck,
  validateTypeScriptCompatibility,
} from '../../scripts/ci/check_typescript_compatibility.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'));
const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
const releaseWorkflow = readFileSync(resolve(repositoryRoot, '.github/workflows/android-release.yml'), 'utf8');
const temporaryRoots = [];

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

function createRepositoryFixture() {
  const root = mkdtempSync(join(tmpdir(), 'conxius-typescript-compat-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  const packageOverride = packageFixture();
  packageOverride.devDependencies.typescript = '7.0.2';
  writeFileSync(join(root, 'package.json'), JSON.stringify(packageOverride));
  const lockfile = lockfileFixture().replace(
    `specifier: ${EXPECTED_TOOLCHAIN.typescriptAlias}\n        version: '@typescript/typescript6@${EXPECTED_TOOLCHAIN.typescriptVersion}'`,
    'specifier: npm:typescript@7.0.2\n        version: typescript@7.0.2',
  );
  writeFileSync(join(root, 'pnpm-lock.yaml'), lockfile);
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
