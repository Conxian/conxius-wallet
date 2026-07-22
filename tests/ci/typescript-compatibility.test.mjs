import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPROVED_TYPESCRIPT_VERSION,
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

function packageFixture(specifier = APPROVED_TYPESCRIPT_VERSION) {
  return { devDependencies: { typescript: specifier } };
}

function lockfileFixture(specifier = APPROVED_TYPESCRIPT_VERSION, version = APPROVED_TYPESCRIPT_VERSION) {
  return `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies:\n      typescript:\n        specifier: ${specifier}\n        version: ${version}\n\npackages:\n`;
}

function validateFixture({ specifier, lockSpecifier, lockVersion, installedTypeScriptVersion } = {}) {
  return validateTypeScriptCompatibility({
    packageJson: packageFixture(specifier),
    lockfile: lockfileFixture(lockSpecifier, lockVersion),
    installedTypeScriptVersion,
  });
}

function createRepositoryFixture() {
  const root = mkdtempSync(join(tmpdir(), 'conxius-typescript-compat-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'node_modules/typescript'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ devDependencies: { typescript: '7.0.2' } }),
  );
  writeFileSync(join(root, 'pnpm-lock.yaml'), lockfileFixture('7.0.2', '7.0.2'));
  writeFileSync(join(root, 'node_modules/typescript/package.json'), JSON.stringify({ version: '7.0.2' }));
  return root;
}

describe('TypeScript compatibility contract', () => {
  it('accepts the approved TypeScript 6 bridge', () => {
    expect(
      validateFixture({
        specifier: APPROVED_TYPESCRIPT_VERSION,
        lockSpecifier: APPROVED_TYPESCRIPT_VERSION,
        lockVersion: APPROVED_TYPESCRIPT_VERSION,
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
      /approved toolchain contract; it is not a claim about all future typescript-eslint compatibility/,
    );
  });

  it('rejects lockfile drift even when package.json remains pinned', () => {
    const errors = validateFixture({ lockVersion: '7.0.2' });

    expect(errors.join('\n')).toMatch(/pnpm-lock\.yaml resolves TypeScript 7\.0\.2/);
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
    expect(packageJson.scripts.build).toContain('pnpm run check:typescript-compat');
    expect(workflow).toContain('run: pnpm run typecheck');
    expect(releaseWorkflow).toContain('run: pnpm run typecheck');
  });
});
