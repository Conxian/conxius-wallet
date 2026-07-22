#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { satisfies, valid, validRange } from 'semver';

const require = createRequire(import.meta.url);

function parseVersion(version, label) {
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
  const parsedVersion = parseVersion(version, 'Installed TypeScript version');
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

export function validateTypeScriptCompatibility(metadata = {}) {
  const { typescript, typescriptEslint } = metadata ?? {};
  const typescriptVersion = parseVersion(typescript?.version, 'Installed TypeScript version').raw;
  const typescriptEslintVersion = parseVersion(typescriptEslint?.version, 'Installed typescript-eslint version').raw;
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
        `  metadata error: ${error.message}`,
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

export function readInstalledPackageMetadata(packageName) {
  let packagePath;
  try {
    packagePath = require.resolve(`${packageName}/package.json`);
  } catch (error) {
    throw new Error(
      `TypeScript compatibility check failed: unable to resolve installed ${packageName} metadata. ` +
        `Install dependencies with the repository's frozen-lockfile command. (${error.message})`,
      { cause: error },
    );
  }

  try {
    return JSON.parse(readFileSync(packagePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `TypeScript compatibility check failed: unable to read ${packageName} metadata at ${packagePath}. (${error.message})`,
      { cause: error },
    );
  }
}

export function readInstalledTypeScriptCompatibility() {
  return {
    typescript: readInstalledPackageMetadata('typescript'),
    typescriptEslint: readInstalledPackageMetadata('typescript-eslint'),
  };
}

export function main() {
  const result = validateTypeScriptCompatibility(readInstalledTypeScriptCompatibility());
  console.log(
    `TypeScript compatibility check passed: TypeScript ${result.typescriptVersion} is supported by ` +
      `typescript-eslint ${result.typescriptEslintVersion} (${result.supportedRange}).`,
  );
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
