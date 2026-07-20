#!/usr/bin/env bash
# Conxius Wallet: Local Verification & Hygiene Suite
set -euo pipefail

echo "--- 🛠️ Environment Check ---"
if ! command -v corepack >/dev/null 2>&1; then
    echo "::error::Corepack is required to select the repository's pinned pnpm version."
    echo "Install a supported Node.js release with Corepack, then run: corepack enable"
    exit 1
fi

EXPECTED_PNPM_VERSION=$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).packageManager.split('@')[1]")
PNPM=(corepack pnpm)
PNPM_VERSION=$("${PNPM[@]}" -v)
if [[ "$PNPM_VERSION" != "$EXPECTED_PNPM_VERSION" ]]; then
    echo "::error::pnpm version mismatch. Expected $EXPECTED_PNPM_VERSION, got $PNPM_VERSION"
    echo "Run: corepack enable && corepack install --global pnpm@$EXPECTED_PNPM_VERSION"
    exit 1
fi

echo "--- 🛡️ Security & Logic Audit ---"
bash scripts/ci/check_runtime_contamination.sh

echo "--- 🧪 Running Unit Tests ---"
"${PNPM[@]}" test --run

echo "--- 🏗️ Type-Checking & Build ---"
"${PNPM[@]}" run build

echo "--- ✅ Hygiene Check Passed ---"
