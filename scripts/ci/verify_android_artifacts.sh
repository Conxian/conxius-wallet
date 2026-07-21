#!/usr/bin/env bash
# Verify Android artifact identity and public signing certificate fingerprints.
set -euo pipefail

if [[ $# -lt 6 ]]; then
  printf 'usage: verify_android_artifacts.sh <apk> <aab> <version> <version-code> <cert-sha256> <metadata-output> [apk-signature-output] [aab-signature-output]\n' >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=scripts/ci/release_path_policy.sh
source "$SCRIPT_DIR/release_path_policy.sh"

APK_PATH="$1"
AAB_PATH="$2"
EXPECTED_VERSION="$3"
EXPECTED_VERSION_CODE="$4"
EXPECTED_CERT_DIGEST_RAW="$5"
METADATA_OUTPUT="$6"
APK_SIGNATURE_OUTPUT="${7:-}"
AAB_SIGNATURE_OUTPUT="${8:-}"

fail() {
  printf '::error::Android artifact identity: %s\n' "$1" >&2
  exit 1
}

require_file() {
  local path="$1"
  [[ -s "$path" ]] || fail "required non-empty artifact is missing: $path"
}

require_executable() {
  local path="$1"
  [[ -x "$path" ]] || fail "required Android tool is missing or not executable: $path"
}

capture_output() {
  local result_name="$1"
  local description="$2"
  shift 2
  local output
  if ! output="$("$@" 2>&1)"; then
    fail "$description failed"
  fi
  printf -v "$result_name" '%s' "$output"
}

last_output_line() {
  printf '%s\n' "$1" | awk 'NF { last = $0 } END { print last }' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

normalize_digest() {
  local normalized
  normalized="$(printf '%s' "$1" | tr -d '[:space:]:-' | tr '[:lower:]' '[:upper:]')"
  [[ "$normalized" =~ ^[0-9A-F]{64}$ ]] || return 1
  printf '%s' "$normalized"
}

find_sdk_tool() {
  local tool_name="$1"
  local sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  local build_tools_version="${ANDROID_BUILD_TOOLS_VERSION:-35.0.0}"
  local pinned_path="$sdk_root/build-tools/$build_tools_version/$tool_name"
  [[ -n "$sdk_root" && -x "$pinned_path" ]] || return 1
  printf '%s\n' "$pinned_path"
}

write_new_file() {
  local path="$1"
  local content="$2"
  [[ ! -e "$path" && ! -L "$path" ]] || fail "refusing to overwrite existing verifier output: $path"
  [[ -d "$(dirname "$path")" ]] || fail "verifier output directory is missing: $(dirname "$path")"
  (set -o noclobber; printf '%s\n' "$content" > "$path") \
    || fail "unable to write verifier output: $path"
}

require_file "$APK_PATH"
require_file "$AAB_PATH"
[[ -n "$EXPECTED_VERSION" ]] || fail "expected version is required"
[[ "$EXPECTED_VERSION_CODE" =~ ^[1-9][0-9]*$ ]] || fail "expected versionCode must be a positive integer"
EXPECTED_CERT_DIGEST="$(normalize_digest "$EXPECTED_CERT_DIGEST_RAW")" \
  || fail "expected signing certificate digest must contain exactly 32 bytes"
METADATA_OUTPUT="$(release_output_file_path "$METADATA_OUTPUT" "$ROOT_DIR")" \
  || fail "metadata output path is outside the approved roots"
if [[ -n "$APK_SIGNATURE_OUTPUT" ]]; then
  APK_SIGNATURE_OUTPUT="$(release_output_file_path "$APK_SIGNATURE_OUTPUT" "$ROOT_DIR")" \
    || fail "APK signature output path is outside the approved roots"
fi
if [[ -n "$AAB_SIGNATURE_OUTPUT" ]]; then
  AAB_SIGNATURE_OUTPUT="$(release_output_file_path "$AAB_SIGNATURE_OUTPUT" "$ROOT_DIR")" \
    || fail "AAB signature output path is outside the approved roots"
fi
[[ ! -e "$METADATA_OUTPUT" ]] || fail "refusing to overwrite existing metadata output: $METADATA_OUTPUT"

APKSIGNER="${APKSIGNER:-}"
if [[ -z "$APKSIGNER" ]]; then
  APKSIGNER="$(find_sdk_tool apksigner || true)"
fi
[[ -n "$APKSIGNER" ]] || fail "apksigner was not found"
require_executable "$APKSIGNER"

APK_ANALYZER="${APK_ANALYZER:-}"
if [[ -z "$APK_ANALYZER" ]]; then
  APK_ANALYZER="$(command -v apkanalyzer || true)"
fi

AAPT2="${AAPT2:-}"
if [[ -z "$AAPT2" ]]; then
  AAPT2="$(find_sdk_tool aapt2 || true)"
fi
if [[ -z "$AAPT2" ]]; then
  AAPT2="$(command -v aapt2 || true)"
fi
if [[ -n "$APK_ANALYZER" ]]; then
  require_executable "$APK_ANALYZER"
else
  require_executable "$AAPT2"
fi

BUNDLETOOL_PATH="${BUNDLETOOL_PATH:-}"
[[ -n "$BUNDLETOOL_PATH" ]] || fail "BUNDLETOOL_PATH is required for AAB identity verification"
[[ -f "$BUNDLETOOL_PATH" || -x "$BUNDLETOOL_PATH" ]] \
  || fail "bundletool is missing: $BUNDLETOOL_PATH"

JARSIGNER="${JARSIGNER:-$(command -v jarsigner || true)}"
KEYTOOL="${KEYTOOL:-$(command -v keytool || true)}"
require_executable "$JARSIGNER"
require_executable "$KEYTOOL"
JAVA="${JAVA:-$(command -v java || true)}"
if [[ "$BUNDLETOOL_PATH" == *.jar ]]; then
  require_executable "$JAVA"
fi

trimmed_value() {
  local value
  value="$(last_output_line "$1")"
  [[ -n "$value" ]] || fail "$2 returned no identity value"
  printf '%s' "$value"
}

if [[ -n "$APK_ANALYZER" ]]; then
  capture_output APK_ID_OUTPUT "apkanalyzer application-id" "$APK_ANALYZER" manifest application-id "$APK_PATH"
  capture_output APK_VERSION_OUTPUT "apkanalyzer version-name" "$APK_ANALYZER" manifest version-name "$APK_PATH"
  capture_output APK_VERSION_CODE_OUTPUT "apkanalyzer version-code" "$APK_ANALYZER" manifest version-code "$APK_PATH"
  APK_ID="$(trimmed_value "$APK_ID_OUTPUT" apkanalyzer)"
  APK_VERSION="$(trimmed_value "$APK_VERSION_OUTPUT" apkanalyzer)"
  APK_VERSION_CODE="$(trimmed_value "$APK_VERSION_CODE_OUTPUT" apkanalyzer)"
else
  capture_output AAPT_BADGING "aapt2 badging" "$AAPT2" dump badging "$APK_PATH"
  APK_ID="$(printf '%s\n' "$AAPT_BADGING" | sed -n "s/^package:.*name='\([^']*\)'.*/\1/p" | head -n 1)"
  APK_VERSION="$(printf '%s\n' "$AAPT_BADGING" | sed -n "s/^package:.*versionName='\([^']*\)'.*/\1/p" | head -n 1)"
  APK_VERSION_CODE="$(printf '%s\n' "$AAPT_BADGING" | sed -n "s/^package:.*versionCode='\([^']*\)'.*/\1/p" | head -n 1)"
  [[ -n "$APK_ID" && -n "$APK_VERSION" && -n "$APK_VERSION_CODE" ]] \
    || fail "aapt2 did not expose complete APK package identity"
fi

[[ "$APK_ID" == "com.conxius.wallet" ]] || fail "APK package ID is not com.conxius.wallet"
[[ "$APK_VERSION" == "$EXPECTED_VERSION" ]] || fail "APK versionName does not match the requested release version"
[[ "$APK_VERSION_CODE" == "$EXPECTED_VERSION_CODE" ]] || fail "APK versionCode does not match the derived release versionCode"
[[ "$APK_VERSION_CODE" =~ ^[1-9][0-9]*$ ]] || fail "APK versionCode is not a positive integer"

capture_output APK_SIGNATURE "apksigner verification" "$APKSIGNER" verify --verbose --print-certs "$APK_PATH"
mapfile -t APK_DIGESTS < <(printf '%s\n' "$APK_SIGNATURE" | awk 'tolower($0) ~ /certificate sha-256 digest:/ { print $NF }')
[[ "${#APK_DIGESTS[@]}" -eq 1 ]] || fail "APK signature must expose exactly one SHA-256 signing certificate"
APK_CERT_DIGEST="$(normalize_digest "${APK_DIGESTS[0]}")" \
  || fail "APK signing certificate digest is malformed"
[[ "$APK_CERT_DIGEST" == "$EXPECTED_CERT_DIGEST" ]] \
  || fail "APK signing certificate digest does not match the expected public fingerprint"

run_bundletool() {
  if [[ "$BUNDLETOOL_PATH" == *.jar ]]; then
    "$JAVA" -jar "$BUNDLETOOL_PATH" "$@"
  else
    "$BUNDLETOOL_PATH" "$@"
  fi
}

capture_output AAB_ID_OUTPUT "bundletool package ID" run_bundletool dump manifest "--bundle=$AAB_PATH" '--xpath=/manifest/@package'
capture_output AAB_VERSION_OUTPUT "bundletool versionName" run_bundletool dump manifest "--bundle=$AAB_PATH" '--xpath=/manifest/@android:versionName'
capture_output AAB_VERSION_CODE_OUTPUT "bundletool versionCode" run_bundletool dump manifest "--bundle=$AAB_PATH" '--xpath=/manifest/@android:versionCode'
AAB_ID="$(trimmed_value "$AAB_ID_OUTPUT" bundletool)"
AAB_VERSION="$(trimmed_value "$AAB_VERSION_OUTPUT" bundletool)"
AAB_VERSION_CODE="$(trimmed_value "$AAB_VERSION_CODE_OUTPUT" bundletool)"

[[ "$AAB_ID" == "com.conxius.wallet" ]] || fail "AAB package ID is not com.conxius.wallet"
[[ "$AAB_VERSION" == "$EXPECTED_VERSION" ]] || fail "AAB versionName does not match the requested release version"
[[ "$AAB_VERSION_CODE" == "$EXPECTED_VERSION_CODE" ]] || fail "AAB versionCode does not match the derived release versionCode"
[[ "$AAB_VERSION_CODE" =~ ^[1-9][0-9]*$ ]] || fail "AAB versionCode is not a positive integer"

capture_output AAB_SIGNATURE "AAB jarsigner verification" "$JARSIGNER" -verify -verbose -certs "$AAB_PATH"
printf '%s\n' "$AAB_SIGNATURE" | grep -Fq 'jar verified.' \
  || fail "jarsigner did not confirm a verified AAB"
capture_output AAB_CERTIFICATE "AAB certificate inspection" "$KEYTOOL" -printcert -jarfile "$AAB_PATH"
mapfile -t AAB_DIGESTS < <(printf '%s\n' "$AAB_CERTIFICATE" | awk '/^[[:space:]]*SHA256:/ { print $2 }')
[[ "${#AAB_DIGESTS[@]}" -eq 1 ]] || fail "AAB signature must expose exactly one SHA-256 signing certificate"
AAB_CERT_DIGEST="$(normalize_digest "${AAB_DIGESTS[0]}")" \
  || fail "AAB signing certificate digest is malformed"
[[ "$AAB_CERT_DIGEST" == "$EXPECTED_CERT_DIGEST" ]] \
  || fail "AAB signing certificate digest does not match the expected public fingerprint"

if [[ -n "$APK_SIGNATURE_OUTPUT" ]]; then
  write_new_file "$APK_SIGNATURE_OUTPUT" "$(printf 'verified=true\ncertificateSha256=%s' "$APK_CERT_DIGEST")"
fi
if [[ -n "$AAB_SIGNATURE_OUTPUT" ]]; then
  write_new_file "$AAB_SIGNATURE_OUTPUT" "$(printf 'verified=true\ncertificateSha256=%s' "$AAB_CERT_DIGEST")"
fi

node --input-type=module - "$METADATA_OUTPUT" "$APK_ID" "$APK_VERSION" "$APK_VERSION_CODE" "$AAB_ID" "$AAB_VERSION" "$AAB_VERSION_CODE" "$EXPECTED_CERT_DIGEST" <<'NODE'
import { writeFileSync } from 'node:fs';

const [, , outputPath, apkPackage, apkVersion, apkVersionCode, aabPackage, aabVersion, aabVersionCode, certificateDigest] = process.argv;
const metadata = {
  artifactContract: 'conxius-wallet-android-release-v2',
  packageName: 'com.conxius.wallet',
  signingCertificateSha256: certificateDigest,
  apk: {
    packageName: apkPackage,
    versionName: apkVersion,
    versionCode: Number(apkVersionCode),
  },
  aab: {
    packageName: aabPackage,
    versionName: aabVersion,
    versionCode: Number(aabVersionCode),
  },
};
writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });
NODE

printf 'Android artifact identity verified: package com.conxius.wallet, version %s, versionCode %s.\n' "$EXPECTED_VERSION" "$EXPECTED_VERSION_CODE"
