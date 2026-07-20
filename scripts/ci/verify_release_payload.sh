#!/usr/bin/env bash
# Verify a downloaded release payload without rebuilding or republishing it.
set -euo pipefail

PAYLOAD_DIR="${1:?usage: verify_release_payload.sh <payload-directory> <version> <tag> <git-sha>}"
EXPECTED_VERSION="${2:?expected version is required}"
EXPECTED_TAG="${3:?expected tag is required}"
EXPECTED_GIT_SHA="${4:?expected source commit SHA is required}"

fail() {
  printf '::error::Downloaded release payload: %s\n' "$1" >&2
  exit 1
}

for file in app-release.apk app-release.aab conxius-wallet.sbom.json release-metadata.json SHA256SUMS; do
  [[ -s "$PAYLOAD_DIR/$file" ]] || fail "required non-empty payload file is missing: $file"
done

(cd "$PAYLOAD_DIR" && sha256sum -c SHA256SUMS) \
  || fail "release payload checksum verification failed"

node --input-type=module - "$PAYLOAD_DIR/release-metadata.json" "$EXPECTED_VERSION" "$EXPECTED_TAG" "$EXPECTED_GIT_SHA" <<'NODE'
import { readFileSync } from 'node:fs';

const [, , metadataPath, expectedVersion, expectedTag, expectedGitSha] = process.argv;
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
if (
  metadata.version !== expectedVersion ||
  metadata.tag !== expectedTag ||
  metadata.gitSha !== expectedGitSha ||
  metadata.artifactContract !== 'conxius-wallet-android-release-v1'
) {
  console.error(JSON.stringify({ metadata, expectedVersion, expectedTag, expectedGitSha }));
  process.exit(1);
}
NODE

printf 'Downloaded release payload verified without rebuild: %s\n' "$PAYLOAD_DIR"
