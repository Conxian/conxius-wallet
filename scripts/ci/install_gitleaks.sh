#!/usr/bin/env bash
# Download the pinned official Gitleaks Linux x64 archive into a temporary path.
set -euo pipefail

readonly GITLEAKS_VERSION='8.30.1'
readonly GITLEAKS_ARCHIVE="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
# SHA-256 from the matching official release checksum manifest:
# https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt
readonly GITLEAKS_SHA256='551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'
readonly GITLEAKS_RELEASE_URL="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}"

fail() {
  printf '::error::Gitleaks installer: %s\n' "$1" >&2
  exit 1
}

if [[ $# -ne 1 ]]; then
  printf 'usage: install_gitleaks.sh <temporary-install-directory>\n' >&2
  exit 2
fi

[[ "$(uname -m)" == 'x86_64' ]] \
  || fail "the pinned workflow archive is Linux x64; runner architecture is $(uname -m)"

INSTALL_DIR="$1"
[[ -n "$INSTALL_DIR" ]] || fail 'temporary install directory must not be empty'
mkdir -p -- "$INSTALL_DIR"
INSTALL_DIR="$(realpath -e -- "$INSTALL_DIR")"

if [[ -n "${RUNNER_TEMP:-}" ]]; then
  RUNNER_TEMP_REAL="$(realpath -e -- "$RUNNER_TEMP")"
  [[ "$INSTALL_DIR" == "$RUNNER_TEMP_REAL"/* ]] \
    || fail "temporary install directory must stay under RUNNER_TEMP"
fi

DOWNLOAD_DIR="$(mktemp -d "${INSTALL_DIR}.download.XXXXXX")"
trap 'rm -rf -- "$DOWNLOAD_DIR"' EXIT

ARCHIVE_PATH="$DOWNLOAD_DIR/$GITLEAKS_ARCHIVE"
curl \
  --fail \
  --silent \
  --show-error \
  --location \
  --proto '=https' \
  --tlsv1.2 \
  --output "$ARCHIVE_PATH" \
  "$GITLEAKS_RELEASE_URL/$GITLEAKS_ARCHIVE"

[[ -s "$ARCHIVE_PATH" && ! -L "$ARCHIVE_PATH" ]] \
  || fail 'downloaded archive is missing, empty, or a symlink'

ACTUAL_SHA256="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
[[ "$ACTUAL_SHA256" == "$GITLEAKS_SHA256" ]] \
  || fail "archive checksum mismatch for $GITLEAKS_ARCHIVE"

tar --extract --file "$ARCHIVE_PATH" --directory "$DOWNLOAD_DIR"
[[ -f "$DOWNLOAD_DIR/gitleaks" && ! -L "$DOWNLOAD_DIR/gitleaks" ]] \
  || fail 'official archive did not contain the expected Gitleaks binary'

install -m 0755 -- "$DOWNLOAD_DIR/gitleaks" "$INSTALL_DIR/gitleaks"
[[ -x "$INSTALL_DIR/gitleaks" && ! -L "$INSTALL_DIR/gitleaks" ]] \
  || fail 'installed Gitleaks binary is missing, not executable, or a symlink'

printf '%s\n' "$INSTALL_DIR/gitleaks"
