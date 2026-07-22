import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  EXPECTED_TOOLCHAIN,
  normalizeCompilerVersion,
  validateCompilerVersions,
  validateLockfile,
  validatePackageManifest,
  validateToolchain,
} from '../../scripts/ci/check_typescript_toolchain.mjs';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'));
const lockfile = readFileSync(resolve(repositoryRoot, 'pnpm-lock.yaml'), 'utf8');
const compilerVersions = {
  ts6: EXPECTED_TOOLCHAIN.ts6ReportedVersion,
  ts7: EXPECTED_TOOLCHAIN.ts7ReportedVersion,
};

describe('TypeScript dual-toolchain guard', () => {
  it('accepts the checked-in aliases, lockfile evidence, scripts, and compiler versions', () => {
    expect(validateToolchain({ packageJson, lockfile, compilerVersions })).toEqual([]);
  });

  it('rejects direct TypeScript 7 under the typescript dependency', () => {
    const candidate = structuredClone(packageJson);
    candidate.devDependencies.typescript = '7.0.2';

    const errors = validatePackageManifest(candidate);
    expect(errors).toContain('typescript must be exactly npm:@typescript/typescript6@6.0.2, found 7.0.2');
    expect(errors).toContain('typescript must not resolve directly to TypeScript 7; TypeScript 7 belongs under @typescript/native');
  });

  it('rejects a missing or incorrect alias record in the lockfile', () => {
    const withoutTypeScript6Record = lockfile.replace(/^  '@typescript\/typescript6@6\.0\.2':\n/m, '');
    const errors = validateLockfile(withoutTypeScript6Record);

    expect(errors).toContain('pnpm-lock.yaml is missing the TypeScript 6 package record @typescript/typescript6@6.0.2');
  });

  it('rejects direct TypeScript 7 importer evidence in the lockfile', () => {
    const directTypeScript7 = lockfile.replace(
      'specifier: npm:@typescript/typescript6@6.0.2\n        version: \'@typescript/typescript6@6.0.2\'',
      'specifier: npm:typescript@7.0.2\n        version: typescript@7.0.2',
    );
    const errors = validateLockfile(directTypeScript7);

    expect(errors).toContain('pnpm-lock.yaml directly assigns TypeScript 7 to the typescript importer');
    expect(errors).toContain(
      'lockfile typescript evidence must be npm:@typescript/typescript6@6.0.2 -> 6.0.2, found npm:typescript@7.0.2 -> typescript@7.0.2',
    );
  });

  it('rejects compiler-version drift while preserving package-version/report-version distinction', () => {
    expect(normalizeCompilerVersion('pnpm v11.13.0\nVersion 6.0.3\n')).toBe('6.0.3');
    expect(validateCompilerVersions({ ts6: '6.0.2', ts7: '7.0.3' })).toEqual([
      'tsc6 must report 6.0.3, found 6.0.2',
      'tsc must report 7.0.2, found 7.0.3',
    ]);
  });

  it('rejects drift in explicit compiler ownership scripts', () => {
    const candidate = structuredClone(packageJson);
    candidate.scripts.typecheck = 'tsc --noEmit';
    candidate.scripts['typecheck:ts6'] = 'tsc --noEmit -p tsconfig.json';

    const errors = validatePackageManifest(candidate);
    expect(errors).toContain(
      'script typecheck must be exactly pnpm run check:typescript-toolchain && pnpm run typecheck:ts7, found tsc --noEmit',
    );
    expect(errors).toContain('script typecheck:ts6 must be exactly tsc6 --noEmit -p tsconfig.ts6.json, found tsc --noEmit -p tsconfig.json');
  });
});
