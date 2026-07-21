import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  repositoryRoot,
  validateSilentPaymentsNativeBuild,
} from '../../scripts/ci/validate_silent_payments_native_build.mjs';

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'conxius-silent-payments-native-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'native/silent-payments-jni'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'android/app'), { recursive: true });
  writeFileSync(
    join(root, 'native/silent-payments-jni/Cargo.toml'),
    '[package]\nname = "fixture"\nversion = "0.1.0"\nedition = "2021"\n',
  );
  writeFileSync(
    join(root, 'scripts/build-silent-payments-android.sh'),
    readFileSync(resolve(repositoryRoot, 'scripts/build-silent-payments-android.sh'), 'utf8'),
  );
  writeFileSync(
    join(root, 'android/app/build.gradle.kts'),
    readFileSync(resolve(repositoryRoot, 'android/app/build.gradle.kts'), 'utf8'),
  );
  return root;
}

describe('silent-payments native build contract', () => {
  it('accepts the repository build configuration', () => {
    expect(validateSilentPaymentsNativeBuild(repositoryRoot)).toEqual([]);
  });

  it('rejects a native script that invokes Cargo from the Gradle cwd', () => {
    const root = createFixture();
    const scriptPath = join(root, 'scripts/build-silent-payments-android.sh');
    const script = readFileSync(scriptPath, 'utf8').replace(
      '  cd "$CRATE_DIR" || fail "unable to enter JNI crate directory: $CRATE_DIR"\n',
      '',
    );
    writeFileSync(scriptPath, script);

    expect(validateSilentPaymentsNativeBuild(root)).toContain(
      'native build script must enter the JNI crate directory before invoking Cargo',
    );
  });

  it('rejects a native script that omits the explicit Cargo manifest path', () => {
    const root = createFixture();
    const scriptPath = join(root, 'scripts/build-silent-payments-android.sh');
    const script = readFileSync(scriptPath, 'utf8').replaceAll('--manifest-path "$MANIFEST"', '');
    writeFileSync(scriptPath, script);

    expect(validateSilentPaymentsNativeBuild(root)).toEqual(
      expect.arrayContaining([
        'native build script must validate metadata with the explicit JNI manifest path',
        'cargo-ndk must receive the explicit JNI manifest path',
      ]),
    );
  });

  it('fails closed when the JNI manifest is missing', () => {
    const root = createFixture();
    rmSync(join(root, 'native/silent-payments-jni/Cargo.toml'));

    expect(validateSilentPaymentsNativeBuild(root)).toContain(
      `JNI Cargo manifest is missing: ${join(root, 'native/silent-payments-jni/Cargo.toml')}`,
    );
  });
});
