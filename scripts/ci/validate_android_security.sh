#!/usr/bin/env bash
# Validate production Android security invariants without relying on Gradle.
set -euo pipefail

ROOT_DIR="${ANDROID_SECURITY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MANIFEST_PATH="${ANDROID_MANIFEST_PATH:-$ROOT_DIR/android/app/src/main/AndroidManifest.xml}"
ACTIVITY_PATH="${ANDROID_MAIN_ACTIVITY_PATH:-$ROOT_DIR/android/app/src/main/kotlin/com/conxius/wallet/MainActivity.kt}"
BUILD_PATH="${ANDROID_APP_BUILD_PATH:-$ROOT_DIR/android/app/build.gradle.kts}"
RULES_PATH="${ANDROID_DATA_EXTRACTION_RULES_PATH:-$ROOT_DIR/android/app/src/main/res/xml/data_extraction_rules.xml}"
ALLOWLIST_PATH="${ANDROID_CLEARTEXT_ALLOWLIST_PATH:-$ROOT_DIR/scripts/ci/android-cleartext-allowlist.txt}"

fail() {
  printf '::error::Android security policy: %s\n' "$1" >&2
  exit 1
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "required production file is missing: $path"
}

require_file "$MANIFEST_PATH"
require_file "$ACTIVITY_PATH"
require_file "$BUILD_PATH"
require_file "$RULES_PATH"
require_file "$ALLOWLIST_PATH"

MANIFEST_CONTENT="$(<"$MANIFEST_PATH")"
BUILD_CONTENT="$(<"$BUILD_PATH")"
RULES_CONTENT="$(<"$RULES_PATH")"

grep -Eq 'android:allowBackup[[:space:]]*=[[:space:]]*"false"' <<<"$MANIFEST_CONTENT" \
  || fail "production manifest must set android:allowBackup=\"false\""
grep -Eq "android:allowBackup[[:space:]]*=[[:space:]]*['\"]true['\"]" <<<"$MANIFEST_CONTENT" \
  && fail "production manifest must not enable android:allowBackup"

grep -Eq 'android:fullBackupContent[[:space:]]*=[[:space:]]*"false"' <<<"$MANIFEST_CONTENT" \
  || fail "production manifest must disable legacy full-backup content"
grep -Eq "android:fullBackupContent[[:space:]]*=[[:space:]]*['\"]true['\"]" <<<"$MANIFEST_CONTENT" \
  && fail "production manifest must not enable legacy full-backup content"
grep -Eq 'android:dataExtractionRules[[:space:]]*=[[:space:]]*"@xml/data_extraction_rules"' <<<"$MANIFEST_CONTENT" \
  || fail "production manifest must reference @xml/data_extraction_rules"

grep -Eq '<data-extraction-rules([[:space:]>])' <<<"$RULES_CONTENT" \
  || fail "data extraction rules must use the Android data-extraction-rules root"
grep -Eq '<cloud-backup([[:space:]>])' <<<"$RULES_CONTENT" \
  || fail "data extraction rules must define cloud-backup policy"
grep -Eq '<device-transfer([[:space:]>])' <<<"$RULES_CONTENT" \
  || fail "data extraction rules must define device-transfer policy"
CLOUD_BACKUP_CONTENT="$(sed -n '/<cloud-backup/,/<\/cloud-backup>/p' "$RULES_PATH")"
DEVICE_TRANSFER_CONTENT="$(sed -n '/<device-transfer/,/<\/device-transfer>/p' "$RULES_PATH")"
grep -Eq '<exclude[^>]*domain="root"[^>]*path="\."' <<<"$CLOUD_BACKUP_CONTENT" \
  || fail "cloud-backup rules must exclude the root domain"
grep -Eq '<exclude[^>]*domain="root"[^>]*path="\."' <<<"$DEVICE_TRANSFER_CONTENT" \
  || fail "device-transfer rules must exclude the root domain"

grep -Eq 'FLAG_SECURE' "$ACTIVITY_PATH" \
  || fail "MainActivity must apply WindowManager.LayoutParams.FLAG_SECURE"
grep -Eq 'addFlags[[:space:]]*\([^)]*FLAG_SECURE' "$ACTIVITY_PATH" \
  || fail "MainActivity must apply FLAG_SECURE through Window.addFlags"

grep -Eq "android:debuggable[[:space:]]*=[[:space:]]*['\"]true['\"]" <<<"$MANIFEST_CONTENT" \
  && fail "production manifest must not enable android:debuggable"
grep -Eq 'isDebuggable[[:space:]]*=[[:space:]]*true' <<<"$BUILD_CONTENT" \
  && fail "Android Gradle configuration must not enable a debuggable build"
grep -Eq 'release[[:space:]]*\{' <<<"$BUILD_CONTENT" \
  || fail "Android Gradle configuration must define a release build type"
grep -Eq 'isDebuggable[[:space:]]*=[[:space:]]*false' <<<"$BUILD_CONTENT" \
  || fail "release build type must explicitly set isDebuggable=false"

cleartext_matches="$(grep -RIlE "android:usesCleartextTraffic[[:space:]]*=[[:space:]]*['\"]true['\"]|cleartextTrafficPermitted[[:space:]]*=[[:space:]]*['\"]true['\"]" "$ROOT_DIR/android/app/src/main" || true)"
if [[ -n "$cleartext_matches" ]]; then
  allowlisted_hosts="$(grep -Ev '^[[:space:]]*(#|$)' "$ALLOWLIST_PATH" || true)"
  [[ -n "$allowlisted_hosts" ]] \
    || fail "cleartext traffic was found in $cleartext_matches but no documented host is allowlisted in $ALLOWLIST_PATH"
  while IFS= read -r entry; do
    [[ "$entry" =~ ^host=[A-Za-z0-9.-]+$ ]] \
      || fail "invalid cleartext allowlist entry '$entry'; expected host=<fully-qualified-host>"
  done <<<"$allowlisted_hosts"
  printf 'Android security policy: cleartext configuration is present and explicitly allowlisted in %s.\n' "$ALLOWLIST_PATH"
else
  printf 'Android security policy: no cleartext traffic configuration detected.\n'
fi

printf 'Android security policy passed: manifest, backup/data extraction, FLAG_SECURE, release debuggability, and cleartext controls are fail-closed.\n'
