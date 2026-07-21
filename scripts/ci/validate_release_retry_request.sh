#!/usr/bin/env bash
# Validate the explicit operator confirmation required before retrying Play.
set -euo pipefail

if [[ $# -ne 4 ]]; then
  printf 'usage: validate_release_retry_request.sh <source-run-id> <source-sha> <version-code> <confirmation>\n' >&2
  exit 2
fi

SOURCE_RUN_ID="$1"
SOURCE_SHA="$2"
VERSION_CODE="$3"
RETRY_CONFIRMATION="$4"

fail() {
  printf '::error::Release retry: %s\n' "$1" >&2
  exit 1
}

[[ "$SOURCE_RUN_ID" =~ ^[1-9][0-9]*$ ]] \
  || fail "source_run_id must be a positive workflow run ID"
[[ "$SOURCE_SHA" =~ ^[0-9a-fA-F]{40}$ ]] \
  || fail "source_sha must be a full 40-character commit SHA"
[[ "$VERSION_CODE" =~ ^[1-9][0-9]*$ ]] \
  || fail "versionCode must be a positive integer"

EXPECTED_CONFIRMATION="PLAY_NOT_PUBLISHED_${VERSION_CODE}"
[[ "$RETRY_CONFIRMATION" == "$EXPECTED_CONFIRMATION" ]] \
  || fail "retry requires the exact confirmation ${EXPECTED_CONFIRMATION} after checking Google Play"

printf 'Release retry request validated for source run %s and versionCode %s.\n' "$SOURCE_RUN_ID" "$VERSION_CODE"
