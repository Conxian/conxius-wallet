import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { satisfies, valid, validRange } from 'semver';
import {
  EXPECTED_TOOLCHAIN,
  runToolchainGuard,
  validateToolchain,
} from './check_typescript_toolchain.mjs';

// Backward-compatible entry point for callers of the TypeScript 6 bridge guard.
// The dual-toolchain guard is authoritative for package aliases, lockfile
// evidence, compiler lanes, and TypeScript 7 promotion checks.
export const APPROVED_TYPESCRIPT_VERSION = EXPECTED_TOOLCHAIN.ts6ReportedVersion;
export const APPROVED_TYPESCRIPT_MAJOR = 6;
export const MIGRATION_ISSUE = '#396';

const DEFAULT_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseInstalledVersion(version, label) {
  const normalized = typeof version === 'string' ? valid(version) : null;
  if (!normalized) {
    throw new Error(`${label} must be a valid semantic version, found ${JSON.stringify(version)}.`);
  }

  return {
    raw: version,
    normalized,
  };
}

export function satisfiesVersionRange(version, range) {
  const parsedVersion = parseInstalledVersion(version, 'Installed TypeScript version');
  if (typeof range !== 'string' || range.trim() === '') {
    throw new Error(`TypeScript peer range must be a non-empty string, found ${JSON.stringify(range)}.`);
  }

  const normalizedRange = validRange(range);
  if (!normalizedRange) {
    throw new Error(
      `TypeScript peer range is not valid npm semver syntax: ${JSON.stringify(range)}. ` +
        'Update typescript-eslint to a release with a valid TypeScript peer range.',
    );
  }

  return satisfies(parsedVersion.normalized, normalizedRange);
}

export function validateInstalledTypeScriptCompatibility(metadata = {}) {
  const { typescript, typescriptEslint } = metadata ?? {};
  const typescriptVersion = parseInstalledVersion(typescript?.version, 'Installed TypeScript version').raw;
  const typescriptEslintVersion = parseInstalledVersion(
    typescriptEslint?.version,
    'Installed typescript-eslint version',
  ).raw;
  const supportedRange = typescriptEslint?.peerDependencies?.typescript;

  if (typeof supportedRange !== 'string' || supportedRange.trim() === '') {
    throw new Error(
      `TypeScript compatibility check failed: typescript-eslint ${typescriptEslintVersion} does not declare ` +
        'a usable TypeScript peer range.',
    );
  }

  let supported;
  try {
    supported = satisfiesVersionRange(typescriptVersion, supportedRange);
  } catch (error) {
    throw new Error(
      'TypeScript compatibility check cannot evaluate installed typescript-eslint metadata.\n' +
        `  installed TypeScript: ${typescriptVersion}\n` +
        `  typescript-eslint: ${typescriptEslintVersion}\n` +
        `  supported TypeScript range: ${supportedRange}\n` +
        `  metadata error: ${formatError(error)}`,
      { cause: error },
    );
  }

  if (!supported) {
    throw new Error(
      'TypeScript compatibility check failed.\n' +
        `  installed TypeScript: ${typescriptVersion}\n` +
        `  typescript-eslint: ${typescriptEslintVersion}\n` +
        `  supported TypeScript range: ${supportedRange}\n` +
        '  remediation: pin the TypeScript 6 API lane within the declared range or upgrade typescript-eslint before running ESLint.',
    );
  }

  return { typescriptVersion, typescriptEslintVersion, supportedRange };
}

export function validateTypeScriptCompatibility({
  packageJson,
  lockfile,
  compilerVersions,
  installedTypeScriptVersion,
  typescript,
  typescriptEslint,
  typescriptEslintMetadataError,
}) {
  const resolvedCompilerVersions = compilerVersions ?? {
    ts6: installedTypeScriptVersion ?? EXPECTED_TOOLCHAIN.ts6ReportedVersion,
    ts7: EXPECTED_TOOLCHAIN.ts7ReportedVersion,
  };
  const errors = validateToolchain({
    packageJson,
    lockfile,
    compilerVersions: resolvedCompilerVersions,
  });

  if (typescriptEslintMetadataError) {
    errors.push(formatError(typescriptEslintMetadataError));
  } else if (typescript !== undefined || typescriptEslint !== undefined) {
    try {
      validateInstalledTypeScriptCompatibility({ typescript, typescriptEslint });
    } catch (error) {
      errors.push(formatError(error));
    }
  }

  return errors;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function readInstalledPackageMetadata(packageName, repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  const requireFromRepository = createRequire(resolve(repositoryRoot, 'package.json'));
  let packagePath;
  try {
    packagePath = requireFromRepository.resolve(`${packageName}/package.json`);
  } catch (error) {
    throw new Error(
      `TypeScript compatibility check failed: unable to resolve installed ${packageName} metadata. ` +
        `Install dependencies with the repository's frozen-lockfile command. (${formatError(error)})`,
      { cause: error },
    );
  }

  try {
    return readJson(packagePath);
  } catch (error) {
    throw new Error(
      `TypeScript compatibility check failed: unable to read ${packageName} metadata at ${packagePath}. (${formatError(
        error,
      )})`,
      { cause: error },
    );
  }
}

export function readInstalledTypeScriptCompatibility(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  return {
    typescript: readInstalledPackageMetadata('typescript', repositoryRoot),
    typescriptEslint: readInstalledPackageMetadata('typescript-eslint', repositoryRoot),
  };
}

function readInstalledPackageMetadataSafely(packageName, repositoryRoot) {
  try {
    return { metadata: readInstalledPackageMetadata(packageName, repositoryRoot), error: null };
  } catch (error) {
    return { metadata: undefined, error };
  }
}

export function runTypeScriptCompatibilityCheck(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  const packageJson = readJson(resolve(repositoryRoot, 'package.json'));
  const lockfile = readFileSync(resolve(repositoryRoot, 'pnpm-lock.yaml'), 'utf8');
  const installedTypeScript = readInstalledPackageMetadataSafely('typescript', repositoryRoot);
  const installedTypeScriptEslint = readInstalledPackageMetadataSafely('typescript-eslint', repositoryRoot);
  const { compilerVersions } = runToolchainGuard(repositoryRoot);
  const errors = validateTypeScriptCompatibility({
    packageJson,
    lockfile,
    compilerVersions,
    typescript: installedTypeScript.metadata,
    typescriptEslint: installedTypeScriptEslint.metadata,
    typescriptEslintMetadataError: installedTypeScriptEslint.error,
  });

  if (errors.length > 0) {
    const message = [
      'TypeScript compatibility check failed:',
      ...errors.map((error) => `- ${error}`),
      `Action: keep the TypeScript 6 API lane at package ${EXPECTED_TOOLCHAIN.typescriptVersion} (reported ${EXPECTED_TOOLCHAIN.ts6ReportedVersion}) and validate TypeScript 7 only through the separately guarded lane for ${MIGRATION_ISSUE}; this remains the separately validated TypeScript 7 migration.`,
      'Scope: this compatibility alias delegates to the repository-owned dual-toolchain contract and validates the installed typescript-eslint peer range as part of Conxius Wallet\'s approved toolchain contract.',
    ].join('\n');
    throw new Error(message);
  }

  return `TypeScript compatibility check passed: tsc6 ${compilerVersions.ts6}, tsc ${compilerVersions.ts7}`;
}

function main() {
  const repositoryRoot = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(dirname(fileURLToPath(import.meta.url)), '../..');

  try {
    console.log(runTypeScriptCompatibilityCheck(repositoryRoot));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
