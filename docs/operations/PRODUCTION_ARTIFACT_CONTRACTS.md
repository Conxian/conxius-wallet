# Production Artifact Contracts (v1.0)

**Date:** 2026-06-15
**Status:** ALIGNED
**Issue:** CON-1204

## 1. Conxius Wallet (Mobile)
- **Artifact:** Android App Bundle (.aab), APK (.apk)
- **Publish Destination:** Google Play Store (Internal/Production), GitHub Releases
- **Install Verification:** Play Integrity API Attestation
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
