import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APPROVED_TYPESCRIPT_VERSION = '6.0.3';
export const APPROVED_TYPESCRIPT_MAJOR = 6;
export const MIGRATION_ISSUE = '#396';

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

export function validateTypeScriptCompatibility({
  packageJson,
  lockfile,
  installedTypeScriptVersion,
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

  return errors;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readInstalledTypeScriptVersion(repositoryRoot) {
  const packagePath = resolve(repositoryRoot, 'node_modules/typescript/package.json');
  if (!existsSync(packagePath)) {
    return null;
  }
  return readJson(packagePath).version;
}

export function runTypeScriptCompatibilityCheck(repositoryRoot) {
  const packageJson = readJson(resolve(repositoryRoot, 'package.json'));
  const lockfile = readFileSync(resolve(repositoryRoot, 'pnpm-lock.yaml'), 'utf8');
  const installedTypeScriptVersion = readInstalledTypeScriptVersion(repositoryRoot);
  const errors = validateTypeScriptCompatibility({
    packageJson,
    lockfile,
    installedTypeScriptVersion,
  });

  if (errors.length > 0) {
    const message = [
      'TypeScript compatibility check failed:',
      ...errors.map((error) => `- ${error}`),
      `Action: keep the repository on TypeScript ${APPROVED_TYPESCRIPT_VERSION} until ${MIGRATION_ISSUE} completes its separately validated TypeScript 7 migration.`,
      'Scope: this guard enforces Conxius Wallet\'s approved toolchain contract; it is not a claim about all future typescript-eslint compatibility.',
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
