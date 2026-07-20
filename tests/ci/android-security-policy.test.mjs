import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const validator = resolve(repositoryRoot, 'scripts/ci/validate_android_security.sh');
const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'conxius-android-security-'));
  temporaryRoots.push(root);
  cpSync(resolve(repositoryRoot, 'android/app/src/main'), join(root, 'android/app/src/main'), { recursive: true });
  cpSync(resolve(repositoryRoot, 'android/app/build.gradle.kts'), join(root, 'android/app/build.gradle.kts'));
  cpSync(
    resolve(repositoryRoot, 'scripts/ci/android-cleartext-allowlist.txt'),
    join(root, 'scripts/ci/android-cleartext-allowlist.txt'),
  );
  return root;
}

function runValidator(root) {
  try {
    execFileSync('bash', [validator], {
      cwd: root,
      env: { ...process.env, ANDROID_SECURITY_ROOT: root },
      stdio: 'pipe',
    });
    return { passed: true, output: '' };
  } catch (error) {
    return { passed: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

describe('Android security policy validator', () => {
  it('accepts the repository production policy', () => {
    const result = runValidator(createFixture());
    expect(result.passed).toBe(true);
  });

  it('fails closed when backups are enabled', () => {
    const root = createFixture();
    const manifestPath = join(root, 'android/app/src/main/AndroidManifest.xml');
    writeFileSync(manifestPath, readFileSync(manifestPath, 'utf8').replace('android:allowBackup="false"', 'android:allowBackup="true"'));

    const result = runValidator(root);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/must set android:allowBackup/);
  });

  it('fails closed when the data extraction policy is missing', () => {
    const root = createFixture();
    rmSync(join(root, 'android/app/src/main/res/xml/data_extraction_rules.xml'));

    const result = runValidator(root);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/required production file is missing/);
  });

  it('fails closed when device transfer is not excluded', () => {
    const root = createFixture();
    const rulesPath = join(root, 'android/app/src/main/res/xml/data_extraction_rules.xml');
    writeFileSync(
      rulesPath,
      readFileSync(rulesPath, 'utf8').replace(
        '<device-transfer>\n        <exclude domain="root" path="." />\n    </device-transfer>',
        '<device-transfer>\n    </device-transfer>',
      ),
    );

    const result = runValidator(root);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/device-transfer rules must exclude/);
  });
});
