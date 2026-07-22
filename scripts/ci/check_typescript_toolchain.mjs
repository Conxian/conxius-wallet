#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const EXPECTED_TOOLCHAIN = Object.freeze({
  nativeAlias: 'npm:typescript@7.0.2',
  nativeVersion: '7.0.2',
  typescriptAlias: 'npm:@typescript/typescript6@6.0.2',
  typescriptVersion: '6.0.2',
  ts6ReportedVersion: '6.0.3',
  ts7ReportedVersion: '7.0.2',
  typecheckScript: 'pnpm run check:typescript-toolchain && pnpm run typecheck:ts7',
  typecheckTs6Script: 'tsc6 --noEmit -p tsconfig.ts6.json',
  typecheckTs7Script: 'tsc --noEmit -p tsconfig.ts7.json',
  buildScript: 'pnpm run check:typescript-toolchain && pnpm run typecheck:ts7 && vite build',
});

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeYamlScalar(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function yamlNamePattern(name) {
  const escaped = escapeRegExp(name);
  return `(?:${escaped}|'${escaped.replaceAll("'", "''")}')`;
}

function readRootImporter(lockfile) {
  const match = lockfile.match(/^importers:\s*\n\n  \.\:\n([\s\S]*?)(?=^packages:\s*$)/m);
  return match?.[1] ?? '';
}

function readImporterEntry(importer, name) {
  const lines = importer.split('\n');
  const namePattern = new RegExp(`^      ${yamlNamePattern(name)}:\\s*$`);
  const start = lines.findIndex((line) => namePattern.test(line));
  if (start < 0) return null;

  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^      \S/.test(lines[index])) break;
    body.push(lines[index]);
  }

  const specifier = body.find((line) => /^        specifier:\s*/.test(line));
  const version = body.find((line) => /^        version:\s*/.test(line));
  return {
    specifier: specifier ? normalizeYamlScalar(specifier.replace(/^        specifier:\s*/, '')) : null,
    version: version ? normalizeYamlScalar(version.replace(/^        version:\s*/, '')) : null,
  };
}

function hasLockPackage(lockfile, packageName) {
  const packages = lockfile.match(/^packages:\s*\n([\s\S]*?)(?=^snapshots:\s*$)/m)?.[1] ?? '';
  const packagePattern = new RegExp(`^  ${yamlNamePattern(packageName)}:\\s*$`, 'm');
  return packagePattern.test(packages);
}

function isAliasResolution(value, packageName, version) {
  return value === version || value === `${packageName}@${version}`;
}

export function validatePackageManifest(packageJson, expected = EXPECTED_TOOLCHAIN) {
  const errors = [];
  const scripts = asRecord(packageJson?.scripts);
  const dependencies = asRecord(packageJson?.dependencies);
  const devDependencies = asRecord(packageJson?.devDependencies);
  const nativeAlias = devDependencies['@typescript/native'];
  const typescriptAlias = devDependencies.typescript;

  for (const name of ['@typescript/native', 'typescript']) {
    if (Object.prototype.hasOwnProperty.call(dependencies, name)) {
      errors.push(`${name} must remain a devDependency, not a production dependency`);
    }
  }

  if (nativeAlias !== expected.nativeAlias) {
    errors.push(`@typescript/native must be exactly ${expected.nativeAlias}, found ${String(nativeAlias)}`);
  }

  if (typescriptAlias !== expected.typescriptAlias) {
    errors.push(`typescript must be exactly ${expected.typescriptAlias}, found ${String(typescriptAlias)}`);
  }

  if (typeof typescriptAlias === 'string' && (/typescript@7(?:\.|$)/.test(typescriptAlias) || /^\^?7\./.test(typescriptAlias))) {
    errors.push('typescript must not resolve directly to TypeScript 7; TypeScript 7 belongs under @typescript/native');
  }

  const expectedScripts = {
    typecheck: expected.typecheckScript,
    'typecheck:ts6': expected.typecheckTs6Script,
    'typecheck:ts7': expected.typecheckTs7Script,
    build: expected.buildScript,
  };
  for (const [name, value] of Object.entries(expectedScripts)) {
    if (scripts[name] !== value) {
      errors.push(`script ${name} must be exactly ${value}, found ${String(scripts[name])}`);
    }
  }

  return errors;
}

export function validateLockfile(lockfile, expected = EXPECTED_TOOLCHAIN) {
  const errors = [];
  const importer = readRootImporter(lockfile);
  if (!importer) {
    return ['pnpm-lock.yaml is missing the root importer'];
  }

  const nativeEntry = readImporterEntry(importer, '@typescript/native');
  const typescriptEntry = readImporterEntry(importer, 'typescript');

  if (
    nativeEntry?.specifier !== expected.nativeAlias ||
    !isAliasResolution(nativeEntry?.version, 'typescript', expected.nativeVersion)
  ) {
    errors.push(
      `lockfile @typescript/native evidence must be ${expected.nativeAlias} -> ${expected.nativeVersion}, found ${String(nativeEntry?.specifier)} -> ${String(nativeEntry?.version)}`,
    );
  }

  if (
    typescriptEntry?.specifier !== expected.typescriptAlias ||
    !isAliasResolution(typescriptEntry?.version, '@typescript/typescript6', expected.typescriptVersion)
  ) {
    errors.push(
      `lockfile typescript evidence must be ${expected.typescriptAlias} -> ${expected.typescriptVersion}, found ${String(typescriptEntry?.specifier)} -> ${String(typescriptEntry?.version)}`,
    );
  }

  if (typescriptEntry?.specifier && /typescript@7(?:\.|$)/.test(typescriptEntry.specifier)) {
    errors.push('pnpm-lock.yaml directly assigns TypeScript 7 to the typescript importer');
  }

  if (!hasLockPackage(lockfile, `typescript@${expected.nativeVersion}`)) {
    errors.push(`pnpm-lock.yaml is missing the TypeScript 7 package record typescript@${expected.nativeVersion}`);
  }

  if (!hasLockPackage(lockfile, `@typescript/typescript6@${expected.typescriptVersion}`)) {
    errors.push(`pnpm-lock.yaml is missing the TypeScript 6 package record @typescript/typescript6@${expected.typescriptVersion}`);
  }

  return errors;
}

export function normalizeCompilerVersion(output) {
  const text = String(output);
  const match = text.match(/(?:^|\n)\s*Version\s+(\d+\.\d+\.\d+)\b/) ?? text.match(/\b(\d+\.\d+\.\d+)\b(?![\s\S]*\b\d+\.\d+\.\d+\b)/);
  return match?.[1] ?? null;
}

export function validateCompilerVersions(compilerVersions, expected = EXPECTED_TOOLCHAIN) {
  const errors = [];
  const ts6 = compilerVersions?.ts6 ?? null;
  const ts7 = compilerVersions?.ts7 ?? null;

  if (ts6 !== expected.ts6ReportedVersion) {
    errors.push(`tsc6 must report ${expected.ts6ReportedVersion}, found ${String(ts6)}`);
  }
  if (ts7 !== expected.ts7ReportedVersion) {
    errors.push(`tsc must report ${expected.ts7ReportedVersion}, found ${String(ts7)}`);
  }

  return errors;
}

export function validateToolchain({ packageJson, lockfile, compilerVersions }, expected = EXPECTED_TOOLCHAIN) {
  return [
    ...validatePackageManifest(packageJson, expected),
    ...validateLockfile(lockfile, expected),
    ...validateCompilerVersions(compilerVersions, expected),
  ];
}

function readCompilerVersion(rootDirectory, command) {
  try {
    const output = execFileSync('pnpm', ['exec', command, '--version'], {
      cwd: rootDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return normalizeCompilerVersion(output);
  } catch {
    return null;
  }
}

export function runToolchainGuard(rootDirectory) {
  const packagePath = resolve(rootDirectory, 'package.json');
  const lockfilePath = resolve(rootDirectory, 'pnpm-lock.yaml');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const lockfile = readFileSync(lockfilePath, 'utf8');
  const compilerVersions = {
    ts6: readCompilerVersion(rootDirectory, 'tsc6'),
    ts7: readCompilerVersion(rootDirectory, 'tsc'),
  };

  return {
    compilerVersions,
    errors: validateToolchain({ packageJson, lockfile, compilerVersions }),
  };
}

function main() {
  const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const { compilerVersions, errors } = runToolchainGuard(rootDirectory);
  if (errors.length > 0) {
    console.error('TypeScript toolchain guard failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `TypeScript toolchain guard passed: tsc6 ${compilerVersions.ts6}, tsc ${compilerVersions.ts7}, aliases and lockfile verified.`,
  );
}

const currentModule = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentModule) {
  main();
}
