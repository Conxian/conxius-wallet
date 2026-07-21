import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { safeOutputPath } from '../../scripts/ci/generate_sbom.mjs';

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const verifier = resolve(repositoryRoot, 'scripts/ci/verify_android_artifacts.sh');
const temporaryRoots = [];
const certificate = 'AB'.repeat(32);
const certificateWithColons = certificate.match(/../g).join(':');

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function executable(root, name, content) {
  const path = join(root, name);
  writeFileSync(path, `#!/usr/bin/env bash\nset -euo pipefail\n${content}\n`);
  chmodSync(path, 0o755);
  return path;
}

function createTools(root, packageName = 'com.conxius.wallet', signingCertificate = certificateWithColons) {
  const apksigner = executable(root, 'apksigner', `[[ "\${1:-}" == verify ]] || exit 1; printf '%s\\n' 'Verified using v3 scheme'; printf '%s\\n' 'Signer #1 certificate SHA-256 digest: ${signingCertificate}'`);
  const apkanalyzer = executable(root, 'apkanalyzer', `case "\${2:-}" in application-id) printf '%s\\n' '${packageName}' ;; version-name) printf '%s\\n' '1.9.5' ;; version-code) printf '%s\\n' '10905' ;; *) exit 1 ;; esac`);
  const bundletool = executable(root, 'bundletool', `for argument in "\$@"; do case "\$argument" in '--xpath=/manifest/@package') printf '%s\\n' '${packageName}' ;; '--xpath=/manifest/@android:versionName') printf '%s\\n' '1.9.5' ;; '--xpath=/manifest/@android:versionCode') printf '%s\\n' '10905' ;; esac; done`);
  const jarsigner = executable(root, 'jarsigner', "printf '%s\\n' 'jar verified.'");
  const keytool = executable(root, 'keytool', `printf '%s\\n' 'SHA256: ${signingCertificate}'`);
  return { apksigner, apkanalyzer, bundletool, jarsigner, keytool };
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'conxius-release-artifact-'));
  temporaryRoots.push(root);
  writeFileSync(join(root, 'app-release.apk'), 'not-a-real-signed-apk-fixture');
  writeFileSync(join(root, 'app-release.aab'), 'not-a-real-signed-aab-fixture');
  return root;
}

function runVerifier(root, tools, expectedCertificate = certificateWithColons, metadataName = 'identity.json') {
  const metadataPath = metadataName.startsWith('/') ? metadataName : join(root, metadataName);
  return execFileSync('bash', [verifier, join(root, 'app-release.apk'), join(root, 'app-release.aab'), '1.9.5', '10905', expectedCertificate, metadataPath], {
    encoding: 'utf8',
    env: { ...process.env, APKSIGNER: tools.apksigner, APK_ANALYZER: tools.apkanalyzer, BUNDLETOOL_PATH: tools.bundletool, JARSIGNER: tools.jarsigner, KEYTOOL: tools.keytool },
    stdio: 'pipe',
  });
}

describe('release artifact identity policy', () => {
  it('verifies package/version/versionCode and public signing fingerprints using mocked tools', () => {
    const root = createFixture();
    const tools = createTools(root);

    expect(runVerifier(root, tools)).toMatch(/identity verified/);
    expect(JSON.parse(readFileSync(join(root, 'identity.json'), 'utf8'))).toMatchObject({
      artifactContract: 'conxius-wallet-android-release-v2',
      packageName: 'com.conxius.wallet',
      signingCertificateSha256: certificate,
      apk: { packageName: 'com.conxius.wallet', versionName: '1.9.5', versionCode: 10905 },
      aab: { packageName: 'com.conxius.wallet', versionName: '1.9.5', versionCode: 10905 },
    });
  });

  it('rejects a package identity mismatch extracted from the APK', () => {
    const root = createFixture();
    const tools = createTools(root, 'com.example.untrusted');

    expect(() => runVerifier(root, tools)).toThrow(/package ID/);
  });

  it('rejects a signing certificate fingerprint mismatch', () => {
    const root = createFixture();
    const tools = createTools(root);

    expect(() => runVerifier(root, tools, 'CD'.repeat(32))).toThrow(/certificate digest/);
  });

  it('rejects verifier output paths outside approved repository or temporary roots', () => {
    const root = createFixture();
    const tools = createTools(root);

    expect(() => runVerifier(root, tools, certificateWithColons, '/etc/conxius-identity.json')).toThrow(
      /outside the approved roots/,
    );
  });

  it('prepares and re-verifies a non-destructive payload with mocked Android tools', () => {
    const root = createFixture();
    const tools = createTools(root);
    const payload = join(root, 'release-payload');
    mkdirSync(payload);
    writeFileSync(join(payload, 'conxius-wallet.sbom.json'), '{"bomFormat":"CycloneDX"}\n');
    const environment = {
      ...process.env,
      APK_PATH: join(root, 'app-release.apk'),
      AAB_PATH: join(root, 'app-release.aab'),
      VERSION: '1.9.5',
      VERSION_CODE: '10905',
      TAG: 'v1.9.5',
      GIT_SHA: '0123456789abcdef0123456789abcdef01234567',
      EXPECTED_SIGNING_CERT_SHA256: certificateWithColons,
      BUNDLETOOL_PATH: tools.bundletool,
      APKSIGNER: tools.apksigner,
      APK_ANALYZER: tools.apkanalyzer,
      JARSIGNER: tools.jarsigner,
      KEYTOOL: tools.keytool,
      RUNNER_TEMP: root,
    };
    execFileSync('bash', [resolve(repositoryRoot, 'scripts/ci/prepare_release_payload.sh'), payload], {
      cwd: repositoryRoot,
      env: environment,
      stdio: 'pipe',
    });
    expect(readFileSync(join(payload, 'release-metadata.json'), 'utf8')).toMatch(/"versionCode": 10905/);
    expect(readFileSync(join(payload, 'apk-signature.txt'), 'utf8')).toBe(
      `verified=true\ncertificateSha256=${certificate}\n`,
    );
    expect(readFileSync(join(payload, 'aab-signature.txt'), 'utf8')).toBe(
      `verified=true\ncertificateSha256=${certificate}\n`,
    );
    execFileSync(
      'bash',
      [resolve(repositoryRoot, 'scripts/ci/verify_release_payload.sh'), payload, '1.9.5', 'v1.9.5', environment.GIT_SHA, '10905'],
      { cwd: repositoryRoot, env: environment, stdio: 'pipe' },
    );
    expect(readFileSync(join(payload, 'conxius-wallet.sbom.json'), 'utf8')).toContain('CycloneDX');
  });

  it('contains SBOM output and refuses overwrite or unsafe paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'conxius-sbom-path-'));
    temporaryRoots.push(root);
    mkdirSync(join(root, 'release-payload'));
    expect(safeOutputPath(root, 'release-payload/conxius-wallet.sbom.json')).toBe(join(root, 'release-payload/conxius-wallet.sbom.json'));
    writeFileSync(join(root, 'release-payload/conxius-wallet.sbom.json'), '{}\n');
    expect(() => safeOutputPath(root, 'release-payload/conxius-wallet.sbom.json')).toThrow(/overwrite/);
    expect(() => safeOutputPath(root, '/etc/release-payload/conxius-wallet.sbom.json')).toThrow(/outside/);
  });
});
