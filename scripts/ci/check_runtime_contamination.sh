#!/usr/bin/env bash
set -euo pipefail

RUNTIME_MANAGER_PATH="android/core-bitcoin/src/main/kotlin/com/conxius/wallet/bitcoin"
WALLET_VIEWMODEL_PATH="android/app/src/main/kotlin/com/conxius/wallet/viewmodel/WalletViewModel.kt"

PLACEHOLDER_PATTERN='_placeholder'
DEMO_WALLET_PATTERN='"staker_pk"|"oracle_pk"|"BTC/USD > 100k"|"secret"|"utxo1"|"asp_pk"|"node_id"|byteArrayOf\(1, 2, 3\)|byteArrayOf\(4, 5, 6\)'

# Use grep, which is available in the base GitHub-hosted runner image, instead
# of relying on optional ripgrep installation. Fail explicitly if the runner
# cannot provide the scanner rather than treating its absence as a clean scan.
if ! command -v grep >/dev/null 2>&1; then
  echo "::error title=CON-393 runtime contamination guard::Required scanner 'grep' was not found on PATH. Provide grep before running this guard."
  exit 127
fi

scan_for_matches() {
  local pattern="$1"
  local description="$2"
  shift 2

  if grep -R -n -H -E -- "$pattern" "$@"; then
    return 0
  else
    local scan_status=$?
  fi

  if [[ "$scan_status" -eq 1 ]]; then
    return 1
  fi

  echo "::error title=CON-393 runtime contamination guard::Scanner failed with exit status $scan_status while scanning $description. Verify the configured paths are present and readable."
  return "$scan_status"
}

echo "[CON-393] Guard: scanning production runtime sources for placeholder literals..."
if scan_for_matches "$PLACEHOLDER_PATTERN" "production runtime sources" "$RUNTIME_MANAGER_PATH" "$WALLET_VIEWMODEL_PATH"; then
  echo "::error::[CON-393] Forbidden '_placeholder' literal found in production runtime sources."
  exit 1
else
  scan_status=$?
  if [[ "$scan_status" -ne 1 ]]; then
    exit "$scan_status"
  fi
fi

echo "[CON-393] Guard: scanning WalletViewModel for hardcoded demo runtime literals..."
if scan_for_matches "$DEMO_WALLET_PATTERN" "WalletViewModel" "$WALLET_VIEWMODEL_PATH"; then
  echo "::error file=$WALLET_VIEWMODEL_PATH::[CON-393] Hardcoded demo runtime literal found."
  exit 1
else
  scan_status=$?
  if [[ "$scan_status" -ne 1 ]]; then
    exit "$scan_status"
  fi
fi

echo "[CON-393] Runtime contamination guard passed."
