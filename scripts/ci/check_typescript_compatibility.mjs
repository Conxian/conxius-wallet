import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { satisfies, valid, validRange } from 'semver';

export const APPROVED_TYPESCRIPT_VERSION = '6.0.3';
export const APPROVED_TYPESCRIPT_MAJOR = 6;
export const MIGRATION_ISSUE = '#396';

const DEFAULT_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function parseVersion(value) {
  const match = String(value ?? '').match(/(?:^|[^\d])(\d+)\.(\d+)\.(\d+)(?:$|[^\d])/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function cleanLockValue(value) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function readRootLockfileEntry(lockfile) {
  const importer = lockfile.match(/^  \.:\n([\s\S]*?)(?=^packages:\n)/m)?.[1];
  if (!importer) {
    return null;
  }

  const entry = importer.match(
    /^      typescript:\n        specifier: ([^\n]+)\n        version: ([^\n]+)/m,
  );
  if (!entry) {
    return null;
  }

  return {
    specifier: cleanLockValue(entry[1]),
    version: cleanLockValue(entry[2]),
  };
}

function describeVersion(value) {
  return value === undefined || value === null ? 'missing' : `\`${value}\``;
}

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
        '  remediation: pin TypeScript within the declared range or upgrade typescript-eslint to a release that declares support before running ESLint.',
    );
  }

  return { typescriptVersion, typescriptEslintVersion, supportedRange };
}

export function validateTypeScriptCompatibility({
  packageJson,
  lockfile,
  installedTypeScriptVersion,
  typescript,
  typescriptEslint,
  typescriptEslintMetadataError,
}) {
  const errors = [];
  const declaredSpecifier = packageJson?.devDependencies?.typescript ?? packageJson?.dependencies?.typescript;
  const declaredVersion = parseVersion(declaredSpecifier);

  if (typeof declaredSpecifier !== 'string' || !declaredVersion) {
    errors.push(
      `Root package.json must declare TypeScript as the exact approved bridge ${APPROVED_TYPESCRIPT_VERSION}; found ${describeVersion(declaredSpecifier)}.`,
    );
  } else if (declaredVersion.major > APPROVED_TYPESCRIPT_MAJOR) {
    errors.push(
      `Root package.json promotes TypeScript ${declaredSpecifier} above the approved TypeScript major ${APPROVED_TYPESCRIPT_MAJOR}.`,
    );
  } else if (declaredSpecifier !== APPROVED_TYPESCRIPT_VERSION) {
    errors.push(
      `Root package.json must keep TypeScript pinned to the exact approved bridge ${APPROVED_TYPESCRIPT_VERSION}; found ${declaredSpecifier}.`,
    );
  }

  const lockfileEntry = typeof lockfile === 'string' ? readRootLockfileEntry(lockfile) : null;
  if (!lockfileEntry) {
    errors.push('pnpm-lock.yaml is missing the root TypeScript importer entry.');
  } else {
    if (lockfileEntry.specifier !== APPROVED_TYPESCRIPT_VERSION) {
      errors.push(
        `pnpm-lock.yaml records TypeScript specifier ${lockfileEntry.specifier}, expected ${APPROVED_TYPESCRIPT_VERSION}.`,
      );
    }
    if (lockfileEntry.version !== APPROVED_TYPESCRIPT_VERSION) {
      errors.push(
        `pnpm-lock.yaml resolves TypeScript ${lockfileEntry.version}, expected ${APPROVED_TYPESCRIPT_VERSION}.`,
      );
    }
  }

  if (installedTypeScriptVersion === null) {
    errors.push('Installed TypeScript package metadata is missing; run `pnpm install --frozen-lockfile`.');
  } else if (
    installedTypeScriptVersion !== undefined &&
    installedTypeScriptVersion !== APPROVED_TYPESCRIPT_VERSION
  ) {
    errors.push(
      `Installed TypeScript is ${installedTypeScriptVersion}, expected ${APPROVED_TYPESCRIPT_VERSION}; run \`pnpm install --frozen-lockfile\`.`,
    );
  }

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
  const errors = validateTypeScriptCompatibility({
    packageJson,
    lockfile,
    installedTypeScriptVersion: installedTypeScript.metadata?.version ?? null,
    typescript: installedTypeScript.metadata,
    typescriptEslint: installedTypeScriptEslint.metadata,
    typescriptEslintMetadataError: installedTypeScriptEslint.error,
  });

  if (errors.length > 0) {
    const message = [
      'TypeScript compatibility check failed:',
      ...errors.map((error) => `- ${error}`),
      `Action: keep the repository on TypeScript ${APPROVED_TYPESCRIPT_VERSION} until ${MIGRATION_ISSUE} completes its separately validated TypeScript 7 migration.`,
      'Scope: this guard enforces Conxius Wallet\'s approved toolchain contract and validates the installed typescript-eslint peer range; it is not a claim about all future typescript-eslint compatibility.',
    ].join('\n');
    throw new Error(message);
  }

  return `TypeScript compatibility check passed: ${APPROVED_TYPESCRIPT_VERSION}`;
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
