#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nodeModulesDirectory = resolve(rootDirectory, 'node_modules');
const manifestPath = resolve(rootDirectory, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const failures = [];

const expected = {
  scripts: {
    'check:typescript-toolchain': 'node scripts/ci/verify_typescript_dual_toolchain.mjs',
    'typecheck:ts6': 'tsc6 --project tsconfig.ts6.json --noEmit',
    'typecheck:ts7': 'tsc --project tsconfig.ts7.json --noEmit',
    'typecheck:dual': 'pnpm run check:typescript-toolchain && pnpm run typecheck:ts6 && pnpm run typecheck:ts7',
  },
  lanes: {
    ts7: {
      dependencyName: '@typescript/native',
      dependencySpecifier: 'npm:typescript@7.0.2',
      packageName: 'typescript',
      packageVersion: '7.0.2',
      binaryName: 'tsc',
      scriptName: 'typecheck:ts7',
      configName: 'tsconfig.ts7.json',
    },
    ts6: {
      dependencyName: 'typescript',
      dependencySpecifier: 'npm:@typescript/typescript6@6.0.2',
      packageName: '@typescript/typescript6',
      packageVersion: '6.0.2',
      binaryName: 'tsc6',
      scriptName: 'typecheck:ts6',
      configName: 'tsconfig.ts6.json',
      compilerDependencyName: '@typescript/old',
      compilerDependencySpecifier: 'npm:typescript@^6',
      compilerPackageName: 'typescript',
      compilerMajor: '6',
    },
  },
};

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function resolvePackageJson(packageName, resolver = require) {
  try {
    return resolver.resolve(`${packageName}/package.json`);
  } catch (error) {
    failures.push(
      `Cannot resolve ${packageName}/package.json from the local install: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function isWithin(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
}

function assertLocalPath(path, label) {
  assert(path && isWithin(nodeModulesDirectory, path),
    `${label} must resolve inside the local node_modules tree, got ${path ?? 'unresolved'}`);
}

function getDeclaredBin(packageMetadata, binaryName, label) {
  const declaredBin = typeof packageMetadata?.bin === 'string'
    ? packageMetadata.bin
    : packageMetadata?.bin?.[binaryName];
  assert(typeof declaredBin === 'string', `${label} must declare bin entrypoint ${binaryName}`);
  assert(!declaredBin?.toLowerCase().endsWith('.cmd'), `${label} must declare a JavaScript entrypoint, not a .cmd shim`);
  return declaredBin;
}

function resolveLane(lane) {
  const packageJsonPath = resolvePackageJson(lane.dependencyName);
  const packageMetadata = packageJsonPath ? readJson(packageJsonPath, `${lane.dependencyName} package metadata`) : null;
  assertLocalPath(packageJsonPath, `${lane.dependencyName} package manifest`);
  assert(packageMetadata?.name === lane.packageName,
    `${lane.dependencyName} must contain package ${lane.packageName}, got ${packageMetadata?.name ?? 'unresolved'}`);
  assert(packageMetadata?.version === lane.packageVersion,
    `${lane.dependencyName} must resolve to ${lane.packageVersion}, got ${packageMetadata?.version ?? 'unresolved'}`);

  const declaredBin = getDeclaredBin(packageMetadata, lane.binaryName, lane.dependencyName);
  const binaryPath = packageJsonPath && declaredBin
    ? resolve(dirname(packageJsonPath), declaredBin)
    : null;
  assert(existsSync(binaryPath ?? ''),
    `${lane.dependencyName} declared bin entrypoint is missing: ${declaredBin ?? 'unresolved'}`);
  assertLocalPath(binaryPath, `${lane.dependencyName} compiler entrypoint`);

  return { packageJsonPath, packageMetadata, binaryPath };
}

function runCompiler(lane, resolvedLane) {
  if (!resolvedLane.binaryPath) return null;

  const result = spawnSync(process.execPath, [resolvedLane.binaryPath, '--version'], {
    cwd: rootDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  const error = result.error instanceof Error ? `: ${result.error.message}` : '';
  assert(result.status === 0, `${lane.binaryName} --version failed${error}: ${output || `exit ${result.status}`}`);
  const match = output.match(/(\d+)\.(\d+)\.(\d+)/);
  assert(match, `${lane.binaryName} --version did not report a semantic version: ${output}`);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

for (const [scriptName, script] of Object.entries(expected.scripts)) {
  assert(manifest.scripts?.[scriptName] === script,
    `${scriptName} must be exactly: ${script}`);
}

for (const lane of Object.values(expected.lanes)) {
  assert(manifest.devDependencies?.[lane.dependencyName] === lane.dependencySpecifier,
    `${lane.dependencyName} must be ${lane.dependencySpecifier}`);

  const configPath = resolve(rootDirectory, lane.configName);
  const configName = lane.configName;
  assert(existsSync(configPath), `Missing TypeScript boundary config: ${configName}`);
  const config = readJson(configPath, configName);
  assert(config?.extends === './tsconfig.json', `${configName} must extend ./tsconfig.json`);
  assert(config?.compilerOptions?.noEmit === true, `${configName} must set compilerOptions.noEmit to true`);
}

const ts7Lane = resolveLane(expected.lanes.ts7);
const ts6Lane = resolveLane(expected.lanes.ts6);
const ts7Version = runCompiler(expected.lanes.ts7, ts7Lane);
const ts6Version = runCompiler(expected.lanes.ts6, ts6Lane);
assert(ts7Version === expected.lanes.ts7.packageVersion,
  `tsc must be TypeScript ${expected.lanes.ts7.packageVersion}, got ${ts7Version ?? 'unresolved'}`);

const ts6CompilerPackagePath = ts6Lane.packageJsonPath
  ? resolvePackageJson(expected.lanes.ts6.compilerDependencyName, createRequire(ts6Lane.packageJsonPath))
  : null;
const ts6CompilerPackage = ts6CompilerPackagePath
  ? readJson(ts6CompilerPackagePath, 'TypeScript 6 compiler package metadata')
  : null;
assert(ts6Lane.packageMetadata?.dependencies?.[expected.lanes.ts6.compilerDependencyName]
    === expected.lanes.ts6.compilerDependencySpecifier,
  `TypeScript 6 bridge must use ${expected.lanes.ts6.compilerDependencyName}@${expected.lanes.ts6.compilerDependencySpecifier}`);
assertLocalPath(ts6CompilerPackagePath, 'TypeScript 6 compiler package manifest');
assert(ts6CompilerPackage?.name === expected.lanes.ts6.compilerPackageName,
  `TypeScript 6 bridge must resolve a ${expected.lanes.ts6.compilerPackageName} compiler, got ${ts6CompilerPackage?.name ?? 'unresolved'}`);
assert(ts6CompilerPackage?.version?.startsWith(`${expected.lanes.ts6.compilerMajor}.`),
  `tsc6 must resolve a TypeScript ${expected.lanes.ts6.compilerMajor} compiler, got ${ts6CompilerPackage?.version ?? 'unresolved'}`);
assert(ts6Version === ts6CompilerPackage?.version,
  `tsc6 reported ${ts6Version ?? 'unresolved'}, but its bridge compiler manifest is ${ts6CompilerPackage?.version ?? 'unresolved'}`);

let apiVersion;
let hasCreateProgram = false;
let apiEntryPath;
try {
  apiEntryPath = require.resolve('typescript');
  assertLocalPath(apiEntryPath, 'TypeScript API entrypoint');
  const typescript = await import('typescript');
  apiVersion = typescript.version;
  hasCreateProgram = typeof typescript.createProgram === 'function';
} catch (error) {
  failures.push(`Cannot import the local TypeScript API: ${error instanceof Error ? error.message : String(error)}`);
}

assert(apiEntryPath === (ts6Lane.packageJsonPath && ts6Lane.packageMetadata?.main
  ? resolve(dirname(ts6Lane.packageJsonPath), ts6Lane.packageMetadata.main)
  : undefined),
  `import('typescript') must resolve through the TypeScript 6 bridge package, got ${apiEntryPath ?? 'unresolved'}`);
assert(apiVersion === ts6CompilerPackage?.version,
  `import('typescript') reported ${apiVersion ?? 'unresolved'}, but its bridge compiler manifest is ${ts6CompilerPackage?.version ?? 'unresolved'}`);
assert(hasCreateProgram, "import('typescript') must expose createProgram for programmatic tooling");

if (failures.length > 0) {
  console.error('TypeScript dual-toolchain verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`TypeScript dual-toolchain verified: tsc ${ts7Version}, tsc6 ${ts6Version}, imported typescript API ${apiVersion}`);
