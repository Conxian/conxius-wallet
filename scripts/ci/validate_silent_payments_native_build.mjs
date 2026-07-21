#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, '../..');

function regularFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

export function validateSilentPaymentsNativeBuild(root = repositoryRoot) {
  const rootDirectory = resolve(root);
  const manifest = resolve(rootDirectory, 'native/silent-payments-jni/Cargo.toml');
  const crateDirectory = dirname(manifest);
  const buildScriptPath = resolve(rootDirectory, 'scripts/build-silent-payments-android.sh');
  const gradlePath = resolve(rootDirectory, 'android/app/build.gradle.kts');
  const errors = [];

  if (!existsSync(crateDirectory)) {
    errors.push(`JNI crate directory is missing: ${crateDirectory}`);
  } else if (!statSync(crateDirectory).isDirectory()) {
    errors.push(`JNI crate path is not a directory: ${crateDirectory}`);
  }
  if (!regularFile(manifest)) {
    errors.push(`JNI Cargo manifest is missing: ${manifest}`);
  }
  if (!regularFile(buildScriptPath)) {
    errors.push(`native build script is missing: ${buildScriptPath}`);
  }
  if (!regularFile(gradlePath)) {
    errors.push(`Android Gradle configuration is missing: ${gradlePath}`);
  }
  if (errors.length > 0) return errors;

  const buildScript = readFileSync(buildScriptPath, 'utf8');
  const gradle = readFileSync(gradlePath, 'utf8');

  if (!buildScript.includes('CRATE_DIR="$ROOT_DIR/native/silent-payments-jni"')) {
    errors.push('native build script must derive the JNI crate directory from ROOT_DIR');
  }
  if (!buildScript.includes('MANIFEST="$CRATE_DIR/Cargo.toml"')) {
    errors.push('native build script must derive Cargo.toml from the JNI crate directory');
  }
  if (!buildScript.includes('cd "$CRATE_DIR"')) {
    errors.push('native build script must enter the JNI crate directory before invoking Cargo');
  }
  if (!buildScript.includes('cargo metadata --manifest-path "$MANIFEST"')) {
    errors.push('native build script must validate metadata with the explicit JNI manifest path');
  }
  if (!buildScript.includes('cargo ndk') || !buildScript.includes('--manifest-path "$MANIFEST"')) {
    errors.push('cargo-ndk must receive the explicit JNI manifest path');
  }
  for (const abi of ['arm64-v8a', 'x86_64']) {
    if (!buildScript.includes(`-t ${abi}`)) {
      errors.push(`cargo-ndk must build the ${abi} target`);
    }
    if (!gradle.includes(`${abi}/libconxius_silent_payments_jni.so`)) {
      errors.push(`Gradle packaging must declare the ${abi} JNI library`);
    }
  }
  if (!buildScript.includes('libconxius_silent_payments_jni.so')) {
    errors.push('native build script must verify the expected JNI library name');
  }
  if (!gradle.includes('workingDir(silentPaymentsNativeRepositoryDir)')) {
    errors.push('Gradle must use an explicit repository working directory for the native task');
  }
  if (!gradle.includes('silentPaymentsNativeCrateDir')) {
    errors.push('Gradle must keep the JNI crate directory explicit in native task configuration');
  }
  if (!gradle.includes('silentPaymentsNativeManifest')) {
    errors.push('Gradle must track the JNI Cargo manifest as a native task input');
  }

  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const errors = validateSilentPaymentsNativeBuild();
  if (errors.length > 0) {
    for (const error of errors) console.error(`::error::Silent-payments native build contract: ${error}`);
    process.exitCode = 1;
  } else {
    console.log('Silent-payments native build contract passed: explicit JNI manifest and Cargo working directory verified.');
  }
}
