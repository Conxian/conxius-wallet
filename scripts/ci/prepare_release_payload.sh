#!/usr/bin/env bash
# Verify signed Android outputs and assemble an immutable release payload.
set -euo pipefail

OUTPUT_DIR="${1:?usage: prepare_release_payload.sh <output-directory>}"
APK_PATH="${APK_PATH:?APK_PATH must point to the signed APK}"
AAB_PATH="${AAB_PATH:?AAB_PATH must point to the signed AAB}"
VERSION="${VERSION:?VERSION must contain the verified release version}"
TAG="${TAG:?TAG must contain the verified release tag}"
GIT_SHA="${GIT_SHA:?GIT_SHA must contain the source commit SHA}"

fail() {
  printf '::error::Release payload: %s\n' "$1" >&2
  exit 1
}

[[ -s "$APK_PATH" ]] || fail "signed APK is missing or empty: $APK_PATH"
[[ -s "$AAB_PATH" ]] || fail "signed AAB is missing or empty: $AAB_PATH"

APKSIGNER="${APKSIGNER:-}"
if [[ -z "$APKSIGNER" ]]; then
  SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  [[ -n "$SDK_ROOT" ]] || fail "ANDROID_HOME/ANDROID_SDK_ROOT is required to locate apksigner"
  APKSIGNER="$(find "$SDK_ROOT/build-tools" -type f -name apksigner -print | sort -V | tail -n 1)"
fi
[[ -x "$APKSIGNER" ]] || fail "apksigner was not found or is not executable"

mkdir -p "$OUTPUT_DIR"
find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 ! -name conxius-wallet.sbom.json -delete
[[ -s "$OUTPUT_DIR/conxius-wallet.sbom.json" ]] || fail "CycloneDX SBOM is missing or empty"
cp "$APK_PATH" "$OUTPUT_DIR/app-release.apk"
cp "$AAB_PATH" "$OUTPUT_DIR/app-release.aab"

"$APKSIGNER" verify --verbose "$OUTPUT_DIR/app-release.apk" > "$OUTPUT_DIR/apk-signature.txt"
jarsigner -verify -verbose -certs "$OUTPUT_DIR/app-release.aab" > "$OUTPUT_DIR/aab-signature.txt"
grep -q 'jar verified\.' "$OUTPUT_DIR/aab-signature.txt" \
  || fail "jarsigner did not confirm a verified AAB"

for file in app-release.apk app-release.aab conxius-wallet.sbom.json apk-signature.txt aab-signature.txt; do
  [[ -s "$OUTPUT_DIR/$file" ]] || fail "release payload file is missing or empty: $file"
done

node --input-type=module - "$OUTPUT_DIR/release-metadata.json" "$VERSION" "$TAG" "$GIT_SHA" <<'NODE'
import { writeFileSync } from 'node:fs';

const [, , outputPath, version, tag, gitSha] = process.argv;
writeFileSync(
  outputPath,
  `${JSON.stringify({ version, tag, gitSha, artifactContract: 'conxius-wallet-android-release-v1' }, null, 2)}\n`,
);
NODE

(
  cd "$OUTPUT_DIR"
  find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%f\n' | sort | xargs -r sha256sum > SHA256SUMS
  sha256sum -c SHA256SUMS
)

printf 'Release payload prepared and verified: %s\n' "$OUTPUT_DIR"
