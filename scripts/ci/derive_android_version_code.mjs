#!/usr/bin/env node

const version = process.argv[2];
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
if (!match) {
  console.error('A strict major.minor.patch version is required to derive Android versionCode.');
  process.exit(1);
}

const [, major, minor, patch] = match;
const versionCode = BigInt(major) * 10000n + BigInt(minor) * 100n + BigInt(patch);
if (versionCode <= 0n || versionCode > 2147483647n) {
  console.error('Derived Android versionCode must be between 1 and 2147483647.');
  process.exit(1);
}

process.stdout.write(`${versionCode}\n`);
