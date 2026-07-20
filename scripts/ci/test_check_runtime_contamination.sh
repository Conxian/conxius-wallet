#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
GUARD_SCRIPT="$SCRIPT_DIR/check_runtime_contamination.sh"
BASH_BIN="$(command -v bash)"
FIXTURE_ROOT="$(mktemp -d)"
RUNTIME_PATH="$FIXTURE_ROOT/android/core-bitcoin/src/main/kotlin/com/conxius/wallet/bitcoin"
VIEWMODEL_PATH="$FIXTURE_ROOT/android/app/src/main/kotlin/com/conxius/wallet/viewmodel/WalletViewModel.kt"

cleanup() {
  rm -rf "$FIXTURE_ROOT"
}
trap cleanup EXIT

setup_fixture() {
  rm -rf "$FIXTURE_ROOT/android"
  mkdir -p "$RUNTIME_PATH" "$(dirname -- "$VIEWMODEL_PATH")"
  printf '%s\n' 'production runtime code' > "$RUNTIME_PATH/RuntimeManager.kt"
  printf '%s\n' 'production wallet viewmodel code' > "$VIEWMODEL_PATH"
  cp "$GUARD_SCRIPT" "$FIXTURE_ROOT/check_runtime_contamination.sh"
}

run_guard() {
  if RUN_OUTPUT=$(cd "$FIXTURE_ROOT" && "$BASH_BIN" "$FIXTURE_ROOT/check_runtime_contamination.sh" 2>&1); then
    RUN_STATUS=0
  else
    RUN_STATUS=$?
  fi
}

run_guard_without_scanner() {
  local empty_path="$FIXTURE_ROOT/empty-path"
  mkdir -p "$empty_path"
  if RUN_OUTPUT=$(cd "$FIXTURE_ROOT" && PATH="$empty_path" "$BASH_BIN" "$FIXTURE_ROOT/check_runtime_contamination.sh" 2>&1); then
    RUN_STATUS=0
  else
    RUN_STATUS=$?
  fi
}

assert_status() {
  local expected="$1"
  local description="$2"
  if [[ "$RUN_STATUS" -ne "$expected" ]]; then
    printf 'FAIL: %s (expected status %s, got %s)\n%s\n' \
      "$description" "$expected" "$RUN_STATUS" "$RUN_OUTPUT" >&2
    exit 1
  fi
}

assert_clean_or_contaminated_status() {
  local description="$1"
  if [[ "$RUN_STATUS" -le 1 ]]; then
    printf 'FAIL: %s (expected scanner failure status > 1, got %s)\n%s\n' \
      "$description" "$RUN_STATUS" "$RUN_OUTPUT" >&2
    exit 1
  fi
}

assert_output_contains() {
  local expected="$1"
  local description="$2"
  if [[ "$RUN_OUTPUT" != *"$expected"* ]]; then
    printf 'FAIL: %s (missing %q)\n%s\n' "$description" "$expected" "$RUN_OUTPUT" >&2
    exit 1
  fi
}

setup_fixture
run_guard
assert_status 0 'clean production paths pass'
assert_output_contains '[CON-393] Runtime contamination guard passed.' 'clean scan reports success'

printf '%s\n' '_placeholder' >> "$RUNTIME_PATH/RuntimeManager.kt"
run_guard
assert_status 1 'placeholder contamination fails the guard'
assert_output_contains "Forbidden '_placeholder' literal" 'placeholder failure is reported'

setup_fixture
printf '%s\n' 'const demo = "secret";' > "$VIEWMODEL_PATH"
run_guard
assert_status 1 'demo literal contamination fails the guard'
assert_output_contains 'Hardcoded demo runtime literal' 'demo literal failure is reported'

setup_fixture
rm -rf "$RUNTIME_PATH"
run_guard
assert_clean_or_contaminated_status 'missing scan path fails closed'
assert_output_contains 'Scanner failed with exit status' 'scan failure is reported'

setup_fixture
run_guard_without_scanner
assert_status 127 'missing scanner fails closed'
assert_output_contains "Required scanner 'grep' was not found on PATH" 'missing scanner is actionable'

printf '%s\n' 'Runtime contamination guard regression tests passed.'
