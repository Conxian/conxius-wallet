#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read JSON metadata at ${path}: ${error.message}`);
  }
}

function requireMatch(content, pattern, description) {
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Unable to find ${description}.`);
  }
  return match[1];
}

export function collectReleaseVersions(rootDir = process.cwd()) {
  const packagePath = resolve(rootDir, 'package.json');
  const metadataPath = resolve(rootDir, 'metadata.json');
  const androidBuildPath = resolve(rootDir, 'android/app/build.gradle.kts');
  const readmePath = resolve(rootDir, 'README.md');
  const changelogPath = resolve(rootDir, 'CHANGELOG.md');

  const packageJson = readJson(packagePath);
  const metadataJson = readJson(metadataPath);
  const androidBuild = readFileSync(androidBuildPath, 'utf8');
  const readme = readFileSync(readmePath, 'utf8');
  const changelog = readFileSync(changelogPath, 'utf8');

  const androidVersionNames = [...androidBuild.matchAll(/\bversionName\s*=\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  if (androidVersionNames.length === 0) {
    throw new Error(`Unable to find Android versionName in ${androidBuildPath}.`);
  }

  return {
    package: packageJson.version,
    metadata: metadataJson.version,
    android: androidVersionNames,
    readme: requireMatch(readme, /\*\*Production \(v([^\s)]+)\)\.\*\*/, 'the README production version claim'),
    changelog: requireMatch(changelog, /^## \[([^\]]+)\]/m, 'the top released CHANGELOG version'),
  };
}

export function validateReleaseVersions(versions, { expectedVersion, expectedTag } = {}) {
  const allVersions = [
    versions.package,
    versions.metadata,
    ...versions.android,
    versions.readme,
    versions.changelog,
  ];
  if (allVersions.some((version) => typeof version !== 'string' || !SEMVER_PATTERN.test(version))) {
    throw new Error(`Every release version must be a semantic version: ${JSON.stringify(versions)}`);
  }

  const canonicalVersion = allVersions[0];
  const drift = allVersions.filter((version) => version !== canonicalVersion);
  if (drift.length > 0) {
    throw new Error(`Release version drift detected: ${JSON.stringify(versions)}`);
  }

  if (expectedVersion !== undefined && expectedVersion !== canonicalVersion) {
    throw new Error(`Expected release version ${expectedVersion}, found ${canonicalVersion}.`);
  }

  if (expectedTag !== undefined) {
    const expectedTagVersion = expectedTag.startsWith('v') ? expectedTag.slice(1) : '';
    if (!expectedTagVersion || expectedTag !== `v${canonicalVersion}`) {
      throw new Error(`Expected release tag v${canonicalVersion}, found ${expectedTag}.`);
    }
  }

  return canonicalVersion;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--expected-version') {
      args.expectedVersion = argv[++index];
    } else if (argument === '--expected-tag') {
      args.expectedTag = argv[++index];
    } else if (argument === '--root') {
      args.rootDir = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const expectedVersion = args.expectedVersion ?? process.env.EXPECTED_VERSION;
  const expectedTag = args.expectedTag ?? process.env.EXPECTED_TAG;
  const versions = collectReleaseVersions(args.rootDir ?? process.cwd());
  const version = validateReleaseVersions(versions, { expectedVersion, expectedTag });
  console.log(`Release version consistency passed: ${version}`);
  console.log(JSON.stringify(versions));
  return version;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
