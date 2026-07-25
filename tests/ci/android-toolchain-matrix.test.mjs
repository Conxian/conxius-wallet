import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ANDROID_TOOLCHAIN_PATHS,
  runAndroidToolchainMatrixCheck,
  validateAndroidToolchainMatrix,
} from '../../scripts/ci/check_android_toolchain_matrix.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function catalogFixture() {
  return `[versions]
agp = "9.3.0"
kotlin = "2.4.10"
ksp = "2.3.10"
compose-bom = "2026.06.01"

[libraries]
androidx-compose-bom = { module = "androidx.compose:compose-bom", version.ref = "compose-bom" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
android-library = { id = "com.android.library", version.ref = "agp" }
compose-compiler = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
`;
}

function job(name, { sdk = 36, ndk = '27.2.12479018', java = '21' } = {}) {
  return `  ${name}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-java@fixture
        with:
          java-version: '${java}'
      - run: sdkmanager "platforms;android-${sdk}" "ndk;${ndk}"
      - working-directory: android
        run: ./gradlew :app:testDebugUnitTest
`;
}

function workflowFixture(jobs) {
  return `name: Fixture
on: push
jobs:
${jobs}
`;
}

function fixture(overrides = {}) {
  return {
    catalog: catalogFixture(),
    appBuild: 'android {\n    compileSdk = 36\n}\n',
    wrapper: 'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.6.1-bin.zip\n',
    ciWorkflow: workflowFixture(job('android-lint')),
    releaseWorkflow: workflowFixture(job('release-verify')),
    ...overrides,
  };
}

function diagnostics(overrides) {
  return validateAndroidToolchainMatrix(fixture(overrides)).errors.join('\n');
}

describe('Android toolchain matrix contract', () => {
  it('accepts a coherent bounded matrix and reports every contract dimension', () => {
    const result = validateAndroidToolchainMatrix(fixture());

    expect(result.errors).toEqual([]);
    expect(result.matrix).toMatchObject({
      compileSdk: 36,
      sdkPlatforms: [36],
      ndks: ['27.2.12479018'],
      java: ['21'],
      gradle: '9.6.1',
      catalogVersions: {
        agp: '9.3.0',
        kotlin: '2.4.10',
        ksp: '2.3.10',
        'compose-bom': '2026.06.01',
      },
    });
  });

  it('rejects compileSdk and hosted SDK platform mismatch', () => {
    expect(diagnostics({ appBuild: 'android {\n    compileSdk = 35\n}\n' })).toMatch(
      /provisions SDK platform\(s\) 36; app compileSdk is 35/,
    );
  });

  it('rejects SDK or NDK divergence between hosted workflows', () => {
    const releaseWorkflow = workflowFixture(job('release-verify', { sdk: 35, ndk: '26.3.11579264' }));

    expect(diagnostics({ releaseWorkflow })).toMatch(/job release-verify diverges.*SDK platforms 35 vs 36.*NDKs 26\.3\.11579264 vs 27\.2\.12479018/);
  });

  it('rejects Java versions other than 21', () => {
    const ciWorkflow = workflowFixture(job('android-lint', { java: '17' }));

    expect(diagnostics({ ciWorkflow })).toMatch(
      /job android-lint actions\/setup-java with\.java-version must be the literal value 21; found "17"/,
    );
  });

  it('does not allow an unrelated action to mask setup-java missing java-version', () => {
    const ciWorkflow = workflowFixture(
      job('android-lint')
        .replace("          java-version: '21'\n", '')
        .replace(
          '      - run: sdkmanager',
          "      - uses: example/unrelated-action@fixture\n        with:\n          java-version: '21'\n      - run: sdkmanager",
        ),
    );

    expect(diagnostics({ ciWorkflow })).toMatch(
      /job android-lint actions\/setup-java must declare with\.java-version exactly once; found 0/,
    );
  });

  it('rejects multiple setup-java steps', () => {
    const ciWorkflow = workflowFixture(
      job('android-lint').replace(
        '      - run: sdkmanager',
        "      - uses: actions/setup-java@second-fixture\n        with:\n          java-version: '21'\n      - run: sdkmanager",
      ),
    );

    expect(diagnostics({ ciWorkflow })).toMatch(
      /job android-lint must contain exactly one actions\/setup-java step; found 2/,
    );
  });

  it('rejects a relevant Android job without setup-java', () => {
    const ciWorkflow = workflowFixture(
      job('android-lint').replace(
        "      - uses: actions/setup-java@fixture\n        with:\n          java-version: '21'\n",
        '',
      ),
    );

    expect(diagnostics({ ciWorkflow })).toMatch(
      /job android-lint must contain exactly one actions\/setup-java step; found 0/,
    );
  });

  it('rejects a nonliteral setup-java version expression', () => {
    const ciWorkflow = workflowFixture(job('android-lint', { java: '${{ matrix.java }}' }));

    expect(diagnostics({ ciWorkflow })).toMatch(
      /job android-lint actions\/setup-java with\.java-version must be the literal value 21; found nonliteral value/,
    );
  });

  it('does not allow an unrelated Java 21 value to mask noncompliant setup-java', () => {
    const ciWorkflow = workflowFixture(
      job('android-lint', { java: '17' }).replace(
        '      - run: sdkmanager',
        "      - uses: example/unrelated-action@fixture\n        with:\n          java-version: '21'\n      - run: sdkmanager",
      ),
    );

    expect(diagnostics({ ciWorkflow })).toMatch(
      /job android-lint actions\/setup-java with\.java-version must be the literal value 21; found "17"/,
    );
  });

  it('rejects duplicate java-version keys inside setup-java', () => {
    const ciWorkflow = workflowFixture(
      job('android-lint').replace(
        "          java-version: '21'",
        "          java-version: '21'\n          java-version: '21'",
      ),
    );

    expect(diagnostics({ ciWorkflow })).toMatch(
      /job android-lint actions\/setup-java must declare with\.java-version exactly once; found 2/,
    );
  });

  it('rejects duplicate or missing catalog declarations', () => {
    const catalog = catalogFixture().replace('kotlin = "2.4.10"', 'agp = "9.4.0"');

    const errors = diagnostics({ catalog });
    expect(errors).toMatch(/\[versions\]\.agp exactly once; found 2/);
    expect(errors).toMatch(/\[versions\]\.kotlin exactly once; found 0/);
  });

  it('rejects inline or incorrect plugin version references', () => {
    const catalog = catalogFixture()
      .replace('version.ref = "agp"', 'version = "9.3.0"')
      .replace('version.ref = "kotlin"', 'version.ref = "compose-bom"');

    const errors = diagnostics({ catalog });
    expect(errors).toMatch(/android-application must use version\.ref = "agp" instead of inline version/);
    expect(errors).toMatch(/compose-compiler must use version\.ref = "kotlin"; found "compose-bom"/);
  });

  it('rejects malformed or missing Gradle wrapper data', () => {
    expect(diagnostics({ wrapper: 'distributionUrl=gradle-latest.zip\n' })).toMatch(
      /malformed or unsupported Gradle distributionUrl/,
    );
    expect(diagnostics({ wrapper: undefined })).toMatch(
      new RegExp(`${ANDROID_TOOLCHAIN_PATHS.wrapper} is missing`),
    );
  });

  it('validates the repository matrix through the package checker entry point', () => {
    expect(runAndroidToolchainMatrixCheck(repositoryRoot)).toMatch(
      /Gradle wrapper: .*no repository compatibility rule is asserted/,
    );
    expect(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')).toContain(
      '"check:android-toolchain": "node scripts/ci/check_android_toolchain_matrix.mjs"',
    );
    expect(readFileSync(resolve(repositoryRoot, ANDROID_TOOLCHAIN_PATHS.ciWorkflow), 'utf8')).toContain(
      'run: node scripts/ci/check_android_toolchain_matrix.mjs',
    );
  });
});
