# Production Artifact Contracts (v1.0)

**Date:** 2026-07-22
**Status:** DEFINED — pre-release; Play Integrity verification and production enforcement pending
**Issue:** CON-1204

## 1. Conxius Wallet (Mobile)
- **Artifact:** Android App Bundle (.aab), APK (.apk)
- **Publish Destination:** Google Play Store (Internal/Production), GitHub Releases
- **Install Verification:** Play Integrity API attestation is a planned release control. Client token acquisition exists; backend verification, request binding, durable freshness/replay policy, centralized enforcement, and real-device qualification remain pending. See the [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md).
- **Rollback Expectation:** Versioned rollback via Play Console
- **Promotion Owner:** COO (Sizwe Nkosi) & Lead Engineer

## 2. Conxian Gateway (Institutional)
- **Artifact:** Static Web Export (Next.js)
- **Publish Destination:** Render (Production), Vercel (Preview), GitHub Pages (Docs)
- **Install Verification:** Automated E2E Smokes (Playwright)
- **Rollback Expectation:** Git revert + redeploy
- **Promotion Owner:** COO (Sizwe Nkosi)

## 3. lib-conxian-core (Shared)
- **Artifact:** NPM Package (@conxian/core), Wasm Binary
- **Publish Destination:** NPM Registry, GitHub Packages
- **Install Verification:** Integrity Hash (SRI/Subresource Integrity)
- **Rollback Expectation:** Version deprecation + patch
- **Promotion Owner:** Lead Engineer
