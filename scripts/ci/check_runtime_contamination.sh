#!/usr/bin/env bash
set -euo pipefail

RUNTIME_MANAGER_PATH="android/core-bitcoin/src/main/kotlin/com/conxius/wallet/bitcoin"
WALLET_VIEWMODEL_PATH="android/app/src/main/kotlin/com/conxius/wallet/viewmodel/WalletViewModel.kt"

PLACEHOLDER_PATTERN='_placeholder'
DEMO_WALLET_PATTERN='"staker_pk"|"oracle_pk"|"BTC/USD > 100k"|"secret"|"utxo1"|"asp_pk"|"node_id"|byteArrayOf\(1, 2, 3\)|byteArrayOf\(4, 5, 6\)'

echo "[CON-393] Guard: scanning production runtime sources for placeholder literals..."
if rg -n --no-heading -e "$PLACEHOLDER_PATTERN" "$RUNTIME_MANAGER_PATH" "$WALLET_VIEWMODEL_PATH"; then
  echo "::error::[CON-393] Forbidden '_placeholder' literal found in production runtime sources."
  exit 1
fi

echo "[CON-393] Guard: scanning WalletViewModel for hardcoded demo runtime literals..."
if rg -n --no-heading -e "$DEMO_WALLET_PATTERN" "$WALLET_VIEWMODEL_PATH"; then
  echo "::error file=$WALLET_VIEWMODEL_PATH::[CON-393] Hardcoded demo runtime literal found."
  exit 1
fi

echo "[CON-393] Runtime contamination guard passed."
