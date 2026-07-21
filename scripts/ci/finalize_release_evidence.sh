#!/usr/bin/env bash
# Create or verify immutable release evidence without rebuilding the Google Play
# payload. Retry mode only verifies already-complete evidence before republishing.
set -euo pipefail

if [[ $# -ne 5 ]]; then
  printf 'usage: finalize_release_evidence.sh <payload-directory> <version> <tag> <source-sha> <mode>\n' >&2
  exit 2
fi

PAYLOAD_DIR="$1"
VERSION="$2"
TAG="$3"
SOURCE_SHA="$4"
MODE="$5"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must identify the repository}"

fail() {
  printf '::error::Release evidence: %s\n' "$1" >&2
  exit 1
}

[[ -d "$PAYLOAD_DIR" && ! -L "$PAYLOAD_DIR" ]] \
  || fail "payload directory must be a real directory: $PAYLOAD_DIR"
[[ "$SOURCE_SHA" =~ ^[0-9a-fA-F]{40}$ ]] \
  || fail "source SHA must be a full 40-character commit SHA"
[[ -n "$VERSION" && -n "$TAG" ]] \
  || fail "version and tag are required"
[[ "$MODE" == "publish" || "$MODE" == "recover" || "$MODE" == "retry" ]] \
  || fail "mode must be publish, retry, or recover"

declare -a RELEASE_ASSETS=(
  app-release.apk
  app-release.aab
  conxius-wallet.sbom.json
  apk-signature.txt
  aab-signature.txt
  release-metadata.json
)

for asset in "${RELEASE_ASSETS[@]}" SHA256SUMS; do
  [[ -f "$PAYLOAD_DIR/$asset" && ! -L "$PAYLOAD_DIR/$asset" && -s "$PAYLOAD_DIR/$asset" ]] \
    || fail "release payload file is missing, empty, or unsafe: $asset"
done

shopt -s nullglob dotglob
PAYLOAD_ENTRIES=("$PAYLOAD_DIR"/*)
shopt -u nullglob dotglob
[[ "${#PAYLOAD_ENTRIES[@]}" -eq "$(( ${#RELEASE_ASSETS[@]} + 1 ))" ]] \
  || fail "release payload contains unexpected files"

(
  cd "$PAYLOAD_DIR"
  sha256sum -c SHA256SUMS
) || fail "release payload checksums do not verify"

node --input-type=module - "$PAYLOAD_DIR/release-metadata.json" "$VERSION" "$TAG" "$SOURCE_SHA" <<'NODE'
import { readFileSync } from 'node:fs';

const [, , metadataPath, expectedVersion, expectedTag, expectedSha] = process.argv;
let metadata;
try {
  metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
} catch {
  console.error('release metadata is not valid JSON');
  process.exit(1);
}
if (
  metadata.version !== expectedVersion ||
  metadata.tag !== expectedTag ||
  metadata.gitSha !== expectedSha ||
  metadata.artifactContract !== 'conxius-wallet-android-release-v2' ||
  metadata.packageName !== 'com.conxius.wallet'
) {
  console.error('release metadata does not match the requested immutable source identity');
  process.exit(1);
}
NODE

git config user.name "conxius-ci"
git config user.email "ci@conxian.io"

tag_exists=0
if git ls-remote --exit-code --refs origin "refs/tags/$TAG" >/dev/null 2>&1; then
  tag_exists=1
fi

resolve_remote_tag() {
  git fetch --no-tags origin "refs/tags/$TAG:refs/tags/$TAG" >/dev/null 2>&1 \
    || fail "release tag exists remotely but could not be fetched: $TAG"
  local resolved_sha
  resolved_sha="$(git rev-list -n 1 "$TAG^{}")" \
    || fail "release tag could not be resolved to a commit: $TAG"
  [[ "$resolved_sha" == "$SOURCE_SHA" ]] \
    || fail "existing release tag does not point to the verified source commit: $TAG"
}

if (( tag_exists == 1 )); then
  [[ "$MODE" == "recover" || "$MODE" == "retry" ]] \
    || fail "release tag already exists; use the explicit retry or recover operation instead of republishing"
  resolve_remote_tag
else
  [[ "$MODE" == "publish" ]] \
    || fail "${MODE} requires the existing immutable release tag; refusing to create evidence"
  git tag -a "$TAG" "$SOURCE_SHA" -m "Release $TAG"
  if ! git push origin "refs/tags/$TAG"; then
    git tag -d "$TAG" >/dev/null 2>&1 || true
    if git ls-remote --exit-code --refs origin "refs/tags/$TAG" >/dev/null 2>&1; then
      resolve_remote_tag
    else
      fail "could not create immutable release tag: $TAG"
    fi
  fi
fi

VERIFY_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/conxius-release-evidence.XXXXXX")"
trap 'rm -rf -- "$VERIFY_DIR"' EXIT

NOTES_PATH="$VERIFY_DIR/release-notes.md"
cat > "$NOTES_PATH" <<EOF
The release payload was built and verified before production publication.

- Source commit: \`$SOURCE_SHA\`
- Android package: \`com.conxius.wallet\`
- Verify all payloads with \`sha256sum -c SHA256SUMS\`.
- SBOM format: CycloneDX 1.5 JSON.
EOF

release_exists=0
if gh release view "$TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  release_exists=1
fi

if (( release_exists == 0 )); then
  [[ "$MODE" == "publish" || "$MODE" == "recover" ]] \
    || fail "retry requires the existing GitHub Release; refusing to create evidence"
  release_paths=()
  for asset in "${RELEASE_ASSETS[@]}" SHA256SUMS; do
    release_paths+=("$PAYLOAD_DIR/$asset")
  done
  gh release create "$TAG" \
    --repo "$GITHUB_REPOSITORY" \
    --verify-tag \
    --title "Conxius Wallet $TAG" \
    --notes-file "$NOTES_PATH" \
    "${release_paths[@]}"
else
  [[ "$MODE" == "recover" || "$MODE" == "retry" ]] \
    || fail "GitHub Release already exists; use the explicit retry or recover operation instead of republishing"
  release_tag="$(gh release view "$TAG" --repo "$GITHUB_REPOSITORY" --json tagName --jq '.tagName')"
  [[ "$release_tag" == "$TAG" ]] \
    || fail "existing GitHub Release has an unexpected tag name: $release_tag"
  is_draft="$(gh release view "$TAG" --repo "$GITHUB_REPOSITORY" --json isDraft --jq '.isDraft')"
  is_prerelease="$(gh release view "$TAG" --repo "$GITHUB_REPOSITORY" --json isPrerelease --jq '.isPrerelease')"
  [[ "$is_draft" == "false" && "$is_prerelease" == "false" ]] \
    || fail "existing GitHub Release is not a published release: $TAG"

  asset_names="$(gh release view "$TAG" --repo "$GITHUB_REPOSITORY" --json assets --jq '.assets[].name')"
  missing_assets=()
  for asset in "${RELEASE_ASSETS[@]}" SHA256SUMS; do
    grep -Fqx -- "$asset" <<< "$asset_names" || missing_assets+=("$asset")
  done
  if (( ${#missing_assets[@]} > 0 )); then
    [[ "$MODE" == "recover" ]] \
      || fail "retry requires every immutable GitHub Release asset to already exist"
    upload_paths=()
    for asset in "${missing_assets[@]}"; do
      upload_paths+=("$PAYLOAD_DIR/$asset")
    done
    gh release upload "$TAG" --repo "$GITHUB_REPOSITORY" "${upload_paths[@]}"
  fi
fi

download_patterns=()
for asset in "${RELEASE_ASSETS[@]}" SHA256SUMS; do
  download_patterns+=(--pattern "$asset")
done
gh release download "$TAG" \
  --repo "$GITHUB_REPOSITORY" \
  --dir "$VERIFY_DIR" \
  "${download_patterns[@]}"
for asset in "${RELEASE_ASSETS[@]}" SHA256SUMS; do
  cmp -- "$PAYLOAD_DIR/$asset" "$VERIFY_DIR/$asset" \
    || fail "GitHub Release asset does not match the verified payload: $asset"
done

printf 'Immutable release evidence verified for %s at %s\n' "$TAG" "$SOURCE_SHA"
