#!/usr/bin/env bash
# Verify provenance attestations for every subject in a downloaded release payload.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf 'usage: verify_release_attestation.sh <payload-directory> <source-sha>\n' >&2
  exit 2
fi

PAYLOAD_DIR="$1"
SOURCE_SHA="$2"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must identify the repository}"

fail() {
  printf '::error::Release attestation: %s\n' "$1" >&2
  exit 1
}

[[ -d "$PAYLOAD_DIR" && ! -L "$PAYLOAD_DIR" ]] \
  || fail "payload directory must be a real directory: $PAYLOAD_DIR"
[[ "$SOURCE_SHA" =~ ^[0-9a-fA-F]{40}$ ]] \
  || fail "source SHA must be a full 40-character commit SHA"

declare -a EXPECTED_SUBJECTS=(
  app-release.apk
  app-release.aab
  conxius-wallet.sbom.json
  apk-signature.txt
  aab-signature.txt
  release-metadata.json
)

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

CHECKSUM_PATH="$PAYLOAD_DIR/SHA256SUMS"
[[ -f "$CHECKSUM_PATH" && ! -L "$CHECKSUM_PATH" && -s "$CHECKSUM_PATH" ]] \
  || fail "SHA256SUMS is missing or unsafe"

shopt -s nullglob dotglob
PAYLOAD_ENTRIES=("$PAYLOAD_DIR"/*)
shopt -u nullglob dotglob
[[ "${#PAYLOAD_ENTRIES[@]}" -eq "$(( ${#EXPECTED_SUBJECTS[@]} + 1 ))" ]] \
  || fail "payload must contain exactly the six release subjects and SHA256SUMS"

declare -A SEEN_SUBJECTS=()
subject_count=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^([0-9a-fA-F]{64})[[:space:]]{2}([^[:space:]]+)$ ]] \
    || fail "SHA256SUMS contains an invalid attestation subject line"
  digest="${BASH_REMATCH[1]}"
  subject="${BASH_REMATCH[2]}"
  is_subject_file "$subject" \
    || fail "SHA256SUMS contains an unexpected attestation subject: $subject"
  [[ -z "${SEEN_SUBJECTS[$subject]:-}" ]] \
    || fail "SHA256SUMS contains a duplicate attestation subject: $subject"
  [[ -f "$PAYLOAD_DIR/$subject" && ! -L "$PAYLOAD_DIR/$subject" && -s "$PAYLOAD_DIR/$subject" ]] \
    || fail "attestation subject is missing, empty, or unsafe: $subject"
  SEEN_SUBJECTS["$subject"]=1
  actual_digest="$(sha256sum "$PAYLOAD_DIR/$subject" | awk '{print $1}')"
  [[ "${actual_digest,,}" == "${digest,,}" ]] \
    || fail "attestation subject checksum does not match: $subject"
  gh attestation verify "$PAYLOAD_DIR/$subject" \
    --repo "$GITHUB_REPOSITORY" \
    --signer-workflow "$GITHUB_REPOSITORY/.github/workflows/android-release.yml" \
    --source-digest "$SOURCE_SHA"
  subject_count=$((subject_count + 1))
done < "$CHECKSUM_PATH"

[[ "$subject_count" -eq "${#EXPECTED_SUBJECTS[@]}" ]] \
  || fail "every release subject must have a verified provenance attestation"
for subject in "${EXPECTED_SUBJECTS[@]}"; do
  [[ -n "${SEEN_SUBJECTS[$subject]:-}" ]] \
    || fail "missing attestation subject: $subject"
done

printf 'Release payload provenance verified for source commit %s\n' "$SOURCE_SHA"
