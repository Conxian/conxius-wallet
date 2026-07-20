import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectReleaseVersions, validateReleaseVersions } from '../../scripts/ci/check_release_version.mjs';

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createFixture(version = '1.9.5') {
  const root = mkdtempSync(join(tmpdir(), 'conxius-release-version-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'android/app'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version }));
  writeFileSync(join(root, 'metadata.json'), JSON.stringify({ version }));
  writeFileSync(join(root, 'android/app/build.gradle.kts'), `android {\n    defaultConfig {\n        versionName = "${version}"\n    }\n}\n`);
  writeFileSync(join(root, 'README.md'), `**Production (v${version}).**\n`);
  writeFileSync(join(root, 'CHANGELOG.md'), `# Changelog\n\n## [${version}] - 2026-07-08\n`);
  return root;
}

describe('release version consistency', () => {
  it('accepts aligned repository metadata and an expected tag', () => {
    const root = createFixture();
    const versions = collectReleaseVersions(root);

    expect(validateReleaseVersions(versions, { expectedVersion: '1.9.5', expectedTag: 'v1.9.5' })).toBe('1.9.5');
  });

  it('rejects drift between the Android version and the release metadata', () => {
    const root = createFixture();
    writeFileSync(join(root, 'android/app/build.gradle.kts'), 'android { defaultConfig { versionName = "1.9.4" } }\n');

    expect(() => validateReleaseVersions(collectReleaseVersions(root))).toThrow(/drift detected/);
  });

  it('rejects a tag that does not exactly identify the verified version', () => {
    const root = createFixture();

    expect(() => validateReleaseVersions(collectReleaseVersions(root), { expectedTag: 'v1.9.4' })).toThrow(
      /Expected release tag v1\.9\.5/,
    );
  });
});
