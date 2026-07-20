#!/usr/bin/env bash
# Verify signed Android outputs and assemble a non-destructive release payload.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=scripts/ci/release_path_policy.sh
source "$SCRIPT_DIR/release_path_policy.sh"

OUTPUT_DIR_REQUESTED="${1:?usage: prepare_release_payload.sh <release-payload-directory>}"
APK_PATH="${APK_PATH:?APK_PATH must point to the signed APK}"
AAB_PATH="${AAB_PATH:?AAB_PATH must point to the signed AAB}"
VERSION="${VERSION:?VERSION must contain the verified release version}"
VERSION_CODE="${VERSION_CODE:?VERSION_CODE must contain the derived positive Android versionCode}"
TAG="${TAG:?TAG must contain the verified release tag}"
GIT_SHA="${GIT_SHA:?GIT_SHA must contain the source commit SHA}"
EXPECTED_SIGNING_CERT_SHA256="${EXPECTED_SIGNING_CERT_SHA256:?EXPECTED_SIGNING_CERT_SHA256 must contain the public signing certificate fingerprint}"
BUNDLETOOL_PATH="${BUNDLETOOL_PATH:?BUNDLETOOL_PATH must point to the pinned bundletool binary or jar}"

fail() {
  printf '::error::Release payload: %s\n' "$1" >&2
  exit 1
}

OUTPUT_DIR="$(release_payload_path "$OUTPUT_DIR_REQUESTED" "$ROOT_DIR")" \
  || fail "release payload directory is outside the approved roots"
[[ -d "$OUTPUT_DIR" && ! -L "$OUTPUT_DIR" ]] \
  || fail "release payload directory must already exist as a real directory: $OUTPUT_DIR"
release_payload_assert_empty_except_sbom "$OUTPUT_DIR" \
  || fail "release payload directory contains unsafe or unexpected pre-existing entries"

for path in "$APK_PATH" "$AAB_PATH"; do
  [[ -f "$path" && ! -L "$path" && -s "$path" ]] \
    || fail "signed Android artifact is missing, empty, or a symlink: $path"
done
[[ "$VERSION_CODE" =~ ^[1-9][0-9]*$ ]] \
  || fail "VERSION_CODE must be a positive integer"
[[ -f "$BUNDLETOOL_PATH" || -x "$BUNDLETOOL_PATH" ]] \
  || fail "pinned bundletool is missing: $BUNDLETOOL_PATH"
[[ -s "$OUTPUT_DIR/conxius-wallet.sbom.json" ]] \
  || fail "CycloneDX SBOM is missing or empty"

VERIFY_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/conxius-release-identity.XXXXXX")"
trap 'rm -rf -- "$VERIFY_DIR"' EXIT

bash "$SCRIPT_DIR/verify_android_artifacts.sh" \
  "$APK_PATH" \
  "$AAB_PATH" \
  "$VERSION" \
  "$VERSION_CODE" \
  "$EXPECTED_SIGNING_CERT_SHA256" \
  "$VERIFY_DIR/identity.json" \
  "$VERIFY_DIR/apk-signature.txt" \
  "$VERIFY_DIR/aab-signature.txt"

for destination in app-release.apk app-release.aab apk-signature.txt aab-signature.txt release-metadata.json SHA256SUMS; do
  [[ ! -e "$OUTPUT_DIR/$destination" ]] \
    || fail "refusing to overwrite existing release payload file: $destination"
done

cp -- "$APK_PATH" "$OUTPUT_DIR/app-release.apk"
cp -- "$AAB_PATH" "$OUTPUT_DIR/app-release.aab"
cp -- "$VERIFY_DIR/apk-signature.txt" "$OUTPUT_DIR/apk-signature.txt"
cp -- "$VERIFY_DIR/aab-signature.txt" "$OUTPUT_DIR/aab-signature.txt"

node --input-type=module - "$VERIFY_DIR/identity.json" "$OUTPUT_DIR/release-metadata.json" "$VERSION" "$VERSION_CODE" "$TAG" "$GIT_SHA" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';

const [, , identityPath, outputPath, version, versionCode, tag, gitSha] = process.argv;
const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
if (
  identity.artifactContract !== 'conxius-wallet-android-release-v2' ||
  identity.packageName !== 'com.conxius.wallet' ||
  identity.apk?.packageName !== 'com.conxius.wallet' ||
  identity.aab?.packageName !== 'com.conxius.wallet' ||
  identity.apk?.versionName !== version ||
  identity.aab?.versionName !== version ||
  String(identity.apk?.versionCode) !== versionCode ||
  String(identity.aab?.versionCode) !== versionCode
) {
  throw new Error('artifact identity verifier returned unexpected package/version metadata');
}

const metadata = {
  ...identity,
  version,
  versionCode: Number(versionCode),
  tag,
  gitSha,
};
writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });
NODE

for file in app-release.apk app-release.aab conxius-wallet.sbom.json apk-signature.txt aab-signature.txt release-metadata.json; do
  [[ -s "$OUTPUT_DIR/$file" && -f "$OUTPUT_DIR/$file" && ! -L "$OUTPUT_DIR/$file" ]] \
    || fail "release payload file is missing, empty, or a symlink: $file"
done

(
  cd "$OUTPUT_DIR"
  for file in app-release.apk app-release.aab conxius-wallet.sbom.json apk-signature.txt aab-signature.txt release-metadata.json; do
    sha256sum "$file"
  done > SHA256SUMS
  sha256sum -c SHA256SUMS
)

printf 'Release payload prepared and verified without cleaning caller-owned files: %s\n' "$OUTPUT_DIR"
