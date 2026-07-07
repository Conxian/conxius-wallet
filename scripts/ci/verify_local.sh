#!/usr/bin/env bash
# Conxius Wallet: Local Verification & Hygiene Suite
set -euo pipefail

echo "--- 🛠️ Environment Check ---"
PNPM_VERSION=\$(pnpm -v)
if [[ "\$PNPM_VERSION" != "10.30.3" ]]; then
    echo "::error::pnpm version mismatch. Expected 10.30.3, got \$PNPM_VERSION"
    false
fi

echo "--- 🛡️ Security & Logic Audit ---"
bash scripts/ci/check_runtime_contamination.sh

echo "--- 🧪 Running Unit Tests ---"
pnpm test --run

echo "--- 🏗️ Type-Checking & Build ---"
pnpm run build

echo "--- ✅ Hygiene Check Passed ---"
