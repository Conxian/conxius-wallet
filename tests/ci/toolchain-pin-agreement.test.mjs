/**
 * The toolchain guard and package.json must agree.
 *
 * EXPECTED_NODE_MAJOR is a hardcoded floor. A floor that lags the declared
 * engine fails silently: `Number('26') < Number('24')` is false, so the guard
 * reports success while enforcing nothing. That drift went unnoticed until an
 * unrelated pnpm assertion exposed it, so it is asserted directly here.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXPECTED_NODE_MAJOR,
  getExpectedPnpmVersion,
  validateToolchainVersion,
} from '../../scripts/ci/check_toolchain_version.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));

/** Lowest major in an engines range such as ">=26 <27" or "^26.0.0". */
function floorMajor(range) {
  const match = String(range).match(/(\d+)/);
  expect(match, `cannot read a major version from engines.node: ${range}`).toBeTruthy();
  return match[1];
}

describe('Toolchain pin agreement', () => {
  it('EXPECTED_NODE_MAJOR matches the engines.node floor', () => {
    expect(
      EXPECTED_NODE_MAJOR,
      `EXPECTED_NODE_MAJOR is ${EXPECTED_NODE_MAJOR} but engines.node is "${pkg.engines.node}"`,
    ).toBe(floorMajor(pkg.engines.node));
  });

  it('the pnpm fallback matches the declared packageManager', () => {
    expect(getExpectedPnpmVersion()).toBe(pkg.packageManager.replace(/^pnpm@/, ''));
  });

  it('rejects the major below the floor and accepts the floor itself', () => {
    const declared = Number(floorMajor(pkg.engines.node));

    const below = validateToolchainVersion({
      nodeVersion: `v${declared - 1}.0.0`,
      expectedPnpm: '12.21.0',
      actualPnpm: '12.21.0',
    });
    expect(below.errors).toHaveLength(1);

    const at = validateToolchainVersion({
      nodeVersion: `v${declared}.0.0`,
      expectedPnpm: '12.21.0',
      actualPnpm: '12.21.0',
    });
    expect(at.errors).toHaveLength(0);
  });
});
