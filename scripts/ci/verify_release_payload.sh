#!/usr/bin/env bash
# Verify a downloaded release payload without rebuilding, mutating, or
# republishing it.
set -euo pipefail

if [[ $# -lt 5 ]]; then
  printf 'usage: verify_release_payload.sh <payload-directory> <version> <tag> <git-sha> <version-code>\n' >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=scripts/ci/release_path_policy.sh
source "$SCRIPT_DIR/release_path_policy.sh"

PAYLOAD_DIR_REQUESTED="$1"
EXPECTED_VERSION="$2"
EXPECTED_TAG="$3"
EXPECTED_GIT_SHA="$4"
EXPECTED_VERSION_CODE="$5"
EXPECTED_SIGNING_CERT_SHA256="${EXPECTED_SIGNING_CERT_SHA256:?EXPECTED_SIGNING_CERT_SHA256 must contain the public signing certificate fingerprint}"
BUNDLETOOL_PATH="${BUNDLETOOL_PATH:?BUNDLETOOL_PATH must point to the pinned bundletool binary or jar}"

fail() {
  printf '::error::Downloaded release payload: %s\n' "$1" >&2
  exit 1
}

PAYLOAD_DIR="$(release_payload_path "$PAYLOAD_DIR_REQUESTED" "$ROOT_DIR")" \
  || fail "payload directory is outside the approved roots"
[[ -d "$PAYLOAD_DIR" && ! -L "$PAYLOAD_DIR" ]] \
  || fail "payload directory must be a real directory"
[[ "$EXPECTED_VERSION_CODE" =~ ^[1-9][0-9]*$ ]] \
  || fail "expected versionCode must be a positive integer"
[[ -f "$BUNDLETOOL_PATH" || -x "$BUNDLETOOL_PATH" ]] \
  || fail "pinned bundletool is missing: $BUNDLETOOL_PATH"

declare -a SUBJECT_FILES=(
  app-release.apk
  app-release.aab
  conxius-wallet.sbom.json
  apk-signature.txt
  aab-signature.txt
  release-metadata.json
)
declare -a PAYLOAD_FILES=("${SUBJECT_FILES[@]}" SHA256SUMS)

is_payload_file() {
  case "$1" in
    app-release.apk|app-release.aab|conxius-wallet.sbom.json|apk-signature.txt|aab-signature.txt|release-metadata.json|SHA256SUMS)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_subject_file() {
  case "$1" in
    app-release.apk|app-release.aab|conxius-wallet.sbom.json|apk-signature.txt|aab-signature.txt|release-metadata.json)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

shopt -s nullglob dotglob
PAYLOAD_ENTRIES=("$PAYLOAD_DIR"/*)
shopt -u nullglob dotglob
for entry in "${PAYLOAD_ENTRIES[@]}"; do
  name="$(basename "$entry")"
  is_payload_file "$name" \
    || fail "payload contains an unexpected file or directory: $name"
  [[ -f "$entry" && ! -L "$entry" && -s "$entry" ]] \
    || fail "payload entry is not a non-empty regular file: $name"
done
[[ "${#PAYLOAD_ENTRIES[@]}" -eq "${#PAYLOAD_FILES[@]}" ]] \
  || fail "payload must contain exactly the six release subjects and SHA256SUMS"

CHECKSUM_PATH="$PAYLOAD_DIR/SHA256SUMS"
[[ -f "$CHECKSUM_PATH" && ! -L "$CHECKSUM_PATH" && -s "$CHECKSUM_PATH" ]] \
  || fail "SHA256SUMS is missing or unsafe"

declare -A SEEN_SUBJECTS=()
checksum_count=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^([0-9a-fA-F]{64})[[:space:]]{2}([^[:space:]]+)$ ]] \
    || fail "SHA256SUMS contains an invalid or unsafe subject line"
  digest="${BASH_REMATCH[1]}"
  subject="${BASH_REMATCH[2]}"
  is_subject_file "$subject" \
    || fail "SHA256SUMS references an unexpected subject: $subject"
  [[ -z "${SEEN_SUBJECTS[$subject]:-}" ]] \
    || fail "SHA256SUMS contains a duplicate subject: $subject"
  SEEN_SUBJECTS["$subject"]=1
  actual_digest="$(sha256sum "$PAYLOAD_DIR/$subject" | awk '{print $1}')"
  [[ "${actual_digest,,}" == "${digest,,}" ]] \
    || fail "SHA256SUMS digest does not match $subject"
  checksum_count=$((checksum_count + 1))
done < "$CHECKSUM_PATH"
[[ "$checksum_count" -eq "${#SUBJECT_FILES[@]}" ]] \
  || fail "SHA256SUMS must contain exactly one entry for each release subject"
for file in "${SUBJECT_FILES[@]}"; do
  [[ -n "${SEEN_SUBJECTS[$file]:-}" ]] || fail "SHA256SUMS is missing subject: $file"
done

EXPECTED_CERT_DIGEST="$(printf '%s' "$EXPECTED_SIGNING_CERT_SHA256" | tr -d '[:space:]:-' | tr '[:lower:]' '[:upper:]')"
[[ "$EXPECTED_CERT_DIGEST" =~ ^[0-9A-F]{64}$ ]] \
  || fail "expected signing certificate digest must contain exactly 32 bytes"

node --input-type=module - "$PAYLOAD_DIR/release-metadata.json" "$EXPECTED_VERSION" "$EXPECTED_TAG" "$EXPECTED_GIT_SHA" "$EXPECTED_VERSION_CODE" "$EXPECTED_CERT_DIGEST" <<'NODE'
import { readFileSync } from 'node:fs';

const [, , metadataPath, expectedVersion, expectedTag, expectedGitSha, expectedVersionCode, expectedCertificate] = process.argv;
let metadata;
try {
  metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
} catch {
  console.error('release metadata is not valid JSON');
  process.exit(1);
}
const certificate = String(metadata.signingCertificateSha256 ?? '').replace(/[\s:-]/g, '').toUpperCase();
if (
  metadata.version !== expectedVersion ||
  metadata.tag !== expectedTag ||
  metadata.gitSha !== expectedGitSha ||
  metadata.versionCode !== Number(expectedVersionCode) ||
  metadata.artifactContract !== 'conxius-wallet-android-release-v2' ||
  metadata.packageName !== 'com.conxius.wallet' ||
  metadata.apk?.packageName !== 'com.conxius.wallet' ||
  metadata.aab?.packageName !== 'com.conxius.wallet' ||
  metadata.apk?.versionName !== expectedVersion ||
  metadata.aab?.versionName !== expectedVersion ||
  metadata.apk?.versionCode !== Number(expectedVersionCode) ||
  metadata.aab?.versionCode !== Number(expectedVersionCode) ||
  certificate !== expectedCertificate
) {
  console.error('release metadata does not match the requested source/artifact identity');
  process.exit(1);
}
NODE

VERIFY_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/conxius-release-payload.XXXXXX")"
trap 'rm -rf -- "$VERIFY_DIR"' EXIT
bash "$SCRIPT_DIR/verify_android_artifacts.sh" \
  "$PAYLOAD_DIR/app-release.apk" \
  "$PAYLOAD_DIR/app-release.aab" \
  "$EXPECTED_VERSION" \
  "$EXPECTED_VERSION_CODE" \
  "$EXPECTED_CERT_DIGEST" \
  "$VERIFY_DIR/reverified-identity.json"

node --input-type=module - "$PAYLOAD_DIR/release-metadata.json" "$VERIFY_DIR/reverified-identity.json" <<'NODE'
import { readFileSync } from 'node:fs';

const [, , metadataPath, identityPath] = process.argv;
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
const sameIdentity = JSON.stringify({
  packageName: metadata.packageName,
  signingCertificateSha256: metadata.signingCertificateSha256,
  apk: metadata.apk,
  aab: metadata.aab,
}) === JSON.stringify({
  packageName: identity.packageName,
  signingCertificateSha256: identity.signingCertificateSha256,
  apk: identity.apk,
  aab: identity.aab,
});
if (!sameIdentity) {
  console.error('artifact identity extracted from the payload does not match release metadata');
  process.exit(1);
}
NODE

printf 'Downloaded release payload verified without rebuild or mutation: %s\n' "$PAYLOAD_DIR"
