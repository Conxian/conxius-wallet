#!/usr/bin/env bash
# Shared release-helper path policy. Source this file; it intentionally performs
# no work when executed directly.

release_payload_path() {
  local requested_path="$1"
  local repository_root="$2"
  local resolved_path
  resolved_path="$(realpath -m -- "$requested_path")" \
    || { printf '::error::Release payload path is not a valid path: %s\n' "$requested_path" >&2; return 1; }

  [[ "$(basename "$resolved_path")" == "release-payload" ]] \
    || { printf '::error::Release payload path must be a release-payload directory: %s\n' "$requested_path" >&2; return 1; }

  local allowed_root raw_root
  local allowed=0
  local -a allowed_roots=("$repository_root")
  [[ -n "${RUNNER_TEMP:-}" ]] && allowed_roots+=("$RUNNER_TEMP")
  [[ -n "${TMPDIR:-}" ]] && allowed_roots+=("$TMPDIR")
  allowed_roots+=("/tmp")

  for raw_root in "${allowed_roots[@]}"; do
    [[ -d "$raw_root" ]] || continue
    allowed_root="$(realpath -e -- "$raw_root")" || continue
    if [[ "$resolved_path" == "$allowed_root" || "$resolved_path" == "$allowed_root"/* ]]; then
      allowed=1
      break
    fi
  done
  (( allowed == 1 )) \
    || { printf '::error::Release payload path is outside the approved temporary/repository roots: %s\n' "$requested_path" >&2; return 1; }

  if [[ -e "$resolved_path" ]]; then
    [[ -d "$resolved_path" && ! -L "$resolved_path" ]] \
      || { printf '::error::Release payload path must be a real directory, not a symlink: %s\n' "$requested_path" >&2; return 1; }
    resolved_path="$(realpath -e -- "$resolved_path")" || return 1
  fi

  printf '%s\n' "$resolved_path"
}

release_payload_assert_empty_except_sbom() {
  local payload_dir="$1"
  local entry name
  shopt -s nullglob dotglob
  for entry in "$payload_dir"/*; do
    name="$(basename "$entry")"
    [[ "$name" == "conxius-wallet.sbom.json" ]] \
      || { printf '::error::Release payload directory contains an unexpected pre-existing entry: %s\n' "$name" >&2; return 1; }
    [[ -f "$entry" && ! -L "$entry" && -s "$entry" ]] \
      || { printf '::error::Release payload SBOM must be a non-empty regular file: %s\n' "$entry" >&2; return 1; }
  done
  shopt -u nullglob dotglob
}

release_output_file_path() {
  local requested_path="$1"
  local repository_root="$2"
  local resolved_path parent allowed_root raw_root
  local allowed=0

  resolved_path="$(realpath -m -- "$requested_path")" \
    || { printf '::error::Release helper output path is not valid: %s\n' "$requested_path" >&2; return 1; }
  parent="$(dirname -- "$resolved_path")"

  local -a allowed_roots=("$repository_root")
  [[ -n "${RUNNER_TEMP:-}" ]] && allowed_roots+=("$RUNNER_TEMP")
  [[ -n "${TMPDIR:-}" ]] && allowed_roots+=("$TMPDIR")
  allowed_roots+=("/tmp")

  for raw_root in "${allowed_roots[@]}"; do
    [[ -d "$raw_root" ]] || continue
    allowed_root="$(realpath -e -- "$raw_root")" || continue
    if [[ "$parent" == "$allowed_root" || "$parent" == "$allowed_root"/* ]]; then
      allowed=1
      break
    fi
  done
  (( allowed == 1 )) \
    || { printf '::error::Release helper output path is outside approved repository/temporary roots: %s\n' "$requested_path" >&2; return 1; }

  [[ ! -L "$parent" ]] \
    || { printf '::error::Release helper output directory must not be a symlink: %s\n' "$parent" >&2; return 1; }
  printf '%s\n' "$resolved_path"
}
