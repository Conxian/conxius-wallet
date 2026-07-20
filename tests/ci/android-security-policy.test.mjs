import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  cpSync(
    resolve(repositoryRoot, 'scripts/ci/validate_android_cleartext.py'),
    join(root, 'scripts/ci/validate_android_cleartext.py'),
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

function manifestPath(root) {
  return join(root, 'android/app/src/main/AndroidManifest.xml');
}

function networkConfigPath(root, name = 'network_security_config') {
  return join(root, 'android/app/src/main/res/xml', `${name}.xml`);
}

function referenceNetworkConfig(root, name = 'network_security_config') {
  const path = manifestPath(root);
  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace(
      'android:usesCleartextTraffic="false"',
      `android:usesCleartextTraffic="false" android:networkSecurityConfig="@xml/${name}"`,
    ),
  );
  mkdirSync(join(root, 'android/app/src/main/res/xml'), { recursive: true });
  return networkConfigPath(root, name);
}

function writeAllowlist(root, content) {
  writeFileSync(join(root, 'scripts/ci/android-cleartext-allowlist.txt'), content);
}

function networkSecurityConfig(content) {
  return `<network-security-config xmlns:android="http://schemas.android.com/apk/res/android">${content}</network-security-config>\n`;
}

describe('Android security policy validator', () => {
  it('accepts the repository production policy', () => {
    const result = runValidator(createFixture());
    expect(result.passed).toBe(true);
  });

  it('fails closed when backups are enabled', () => {
    const root = createFixture();
    writeFileSync(manifestPath(root), readFileSync(manifestPath(root), 'utf8').replace('android:allowBackup="false"', 'android:allowBackup="true"'));

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

  it('fails closed when usesCleartextTraffic is not explicitly disabled', () => {
    const root = createFixture();
    const path = manifestPath(root);
    writeFileSync(path, readFileSync(path, 'utf8').replace('        android:usesCleartextTraffic="false"\n', ''));

    const result = runValidator(root);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/must explicitly set android:usesCleartextTraffic/);
  });

  it('fails closed for stale cleartext allowlist entries', () => {
    const root = createFixture();
    writeAllowlist(root, 'host=api.example.com\n');

    const result = runValidator(root);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/stale\/unused allowlist entries/);
  });

  it('rejects global cleartext enablement even when an entry is allowlisted', () => {
    const root = createFixture();
    const path = manifestPath(root);
    writeFileSync(path, readFileSync(path, 'utf8').replace('android:usesCleartextTraffic="false"', 'android:usesCleartextTraffic="true"'));
    writeAllowlist(root, 'host=api.example.com\n');

    const result = runValidator(root);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/usesCleartextTraffic=true/);
  });

  it('rejects base-config cleartext enablement', () => {
    const root = createFixture();
    const configPath = referenceNetworkConfig(root);
    writeFileSync(
      configPath,
      networkSecurityConfig('<base-config android:cleartextTrafficPermitted="true" />'),
    );

    const result = runValidator(root);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/base-config cleartextTrafficPermitted=true/);
  });

  it('matches an exact enabled domain to an exact allowlist entry', () => {
    const root = createFixture();
    const configPath = referenceNetworkConfig(root);
    writeFileSync(
      configPath,
      networkSecurityConfig('<domain-config android:cleartextTrafficPermitted="true"><domain>api.example.com</domain></domain-config>'),
    );
    writeAllowlist(root, 'host=api.example.com\n');

    expect(runValidator(root).passed).toBe(true);
  });

  it('requires includeSubdomains semantics to match exactly', () => {
    const root = createFixture();
    const configPath = referenceNetworkConfig(root);
    writeFileSync(
      configPath,
      networkSecurityConfig('<domain-config android:cleartextTrafficPermitted="true"><domain android:includeSubdomains="true">api.example.com</domain></domain-config>'),
    );
    writeAllowlist(root, 'host=api.example.com\n');
    const missingFlag = runValidator(root);
    expect(missingFlag.passed).toBe(false);
    expect(missingFlag.output).toMatch(/missing allowlist entries/);

    writeAllowlist(root, 'host=api.example.com;includeSubdomains=true\n');
    expect(runValidator(root).passed).toBe(true);
  });

  it.each(['*.example.com', '192.0.2.10', 'localhost', 'bad host.example.com'])(
    'rejects unsupported cleartext host %s',
    (host) => {
      const root = createFixture();
      const configPath = referenceNetworkConfig(root);
      writeFileSync(
        configPath,
        networkSecurityConfig(`<domain-config android:cleartextTrafficPermitted="true"><domain>${host}</domain></domain-config>`),
      );
      writeAllowlist(root, `host=${host}\n`);

      const result = runValidator(root);
      expect(result.passed).toBe(false);
      expect(result.output).toMatch(/wildcard|IP addresses|fully-qualified|invalid DNS/);
    },
  );

  it('does not treat an unused network config as an active exception', () => {
    const root = createFixture();
    writeFileSync(
      networkConfigPath(root),
      networkSecurityConfig('<domain-config android:cleartextTrafficPermitted="true"><domain>api.example.com</domain></domain-config>'),
    );

    expect(runValidator(root).passed).toBe(true);
  });

  it('fails closed when the referenced network config is missing', () => {
    const root = createFixture();
    referenceNetworkConfig(root);
    rmSync(networkConfigPath(root), { force: true });

    const result = runValidator(root);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/referenced network security config is missing/);
  });

  it('fails closed when a resource-qualified network config enables a different policy', () => {
    const root = createFixture();
    const baseConfigPath = referenceNetworkConfig(root);
    writeFileSync(baseConfigPath, networkSecurityConfig('<base-config android:cleartextTrafficPermitted="false" />'));
    const qualifiedDirectory = join(root, 'android/app/src/main/res/xml-v24');
    mkdirSync(qualifiedDirectory, { recursive: true });
    writeFileSync(
      join(qualifiedDirectory, 'network_security_config.xml'),
      networkSecurityConfig('<domain-config android:cleartextTrafficPermitted="true"><domain>api.example.com</domain></domain-config>'),
    );
    writeAllowlist(root, 'host=api.example.com\n');

    const result = runValidator(root);
    expect(result.passed).toBe(false);
    expect(result.output).toMatch(/resource-qualified network security configs/);
  });
});
