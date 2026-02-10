# Conxius Wallet: Gaps & Recommendations

**Last Updated:** 2026-02-10  
**Total Gaps Identified:** 30 (original) + 7 (newly discovered)  
**Resolved:** 5 P0s + 1 P1  
**Repository:** <https://github.com/conxian/conxius-wallet>  
**Cross-Reference:** See `IMPLEMENTATION_REGISTRY.md` for full feature-level status

---

## 🚨 PRIORITY CLASSIFICATION

| Priority | Original | Resolved | Remaining | Action Timeline |
|----------|----------|----------|-----------|-----------------|
| 🔴 **P0 - Critical** | 5 | **5** | 0 | ✅ All resolved |
| 🟠 **P1 - High** | 8 | **1** | 7 + 3 new | This Week |
| 🟡 **P2 - Medium** | 12 | 0 | 12 + 4 new | Next 2 Weeks |
| 🟢 **P3 - Low** | 5 | 0 | 5 | Next Month |

---

## 🔴 P0 - CRITICAL GAPS (All Resolved ✅)

### 1. ~~No Tests for Core Services~~ ✅ RESOLVED

**Location:** `services/signer.ts`, `services/enclave-storage.ts`, `services/protocol.ts`  
**Severity:** 🔴 Critical  
**Status:** ✅ Resolved — `signer.test.ts` (230 lines), `protocol.test.ts` (515 lines), `enclave-storage.test.ts` (311 lines) now exist.  
**Issue:** ~~Zero unit tests for critical security and business logic.~~  
**Impact:** Regressions undetected, security vulnerabilities may be introduced.  
**Recommendation:**

- Write comprehensive tests for `signer.ts` (BIP-39/32 derivation, PSBT signing)
- Write tests for `enclave-storage.ts` (encryption/decryption, biometric flow)
- Write tests for `protocol.ts` (API error handling, retry logic)
**Effort:** 16 hours  
**Files to Create:** `tests/signer.test.ts`, `tests/enclave-storage.test.ts`, `tests/protocol.test.ts`

---

### 2. ~~API Key Exposure Risk~~ ✅ RESOLVED

**Location:** `.env.local`  
**Severity:** 🔴 Critical  
**Status:** ✅ Resolved — `.gitignore` line 13 has `*.local` and line 34 has `.env*.local`. Both patterns cover `.env.local`.  
**Issue:** ~~Placeholder pattern suggests real keys might be committed. File is not in `.gitignore`.~~  
**Impact:** Accidental credential exposure in git history.  
**Recommendation:**

```bash
# Add to .gitignore
.env*.local
*.keystore
*.jks
service-account*.json
```

**Effort:** 5 minutes  
**Files to Modify:** `.gitignore`

---

### 3. ~~No CI/CD Pipeline~~ ✅ RESOLVED

**Location:** `.github/workflows/ci.yml`  
**Severity:** 🔴 Critical  
**Status:** ✅ Resolved — Full CI pipeline: lint, tsc, test, build, pnpm audit, TruffleHog secret scanning, artifact upload.  
**Issue:** ~~No automated testing, security scanning, or deployment verification.~~  
**Impact:** Manual errors, undetected regressions, no deployment safety net.  
**Recommendation:**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run build
```

**Effort:** 30 minutes  
**Files to Create:** `.github/workflows/ci.yml`

---

### 4. ~~Wildcard Dependency Risk~~ ✅ RESOLVED

**Location:** `package.json`  
**Severity:** 🔴 Critical  
**Status:** ✅ Resolved — `@google/genai` now pinned to `^1.40.0`.  
**Issue:** ~~`"@google/genai": "*"` - unversioned major dependency.~~  
**Impact:** Breaking changes from future updates, non-reproducible builds.  
**Recommendation:**

```json
"@google/genai": "^0.5.0"
```

**Effort:** 5 minutes  
**Files to Modify:** `package.json`

---

### 5. ~~Vite Dev Server Exposed~~ ✅ RESOLVED

**Location:** `vite.config.ts`  
**Severity:** 🔴 Critical  
**Status:** ✅ Resolved — Host changed to `127.0.0.1` (localhost only). CSP headers also added.  
**Issue:** ~~`host: "0.0.0.0"` exposes dev server to network.~~  
**Impact:** Potential unauthorized access during development.  
**Recommendation:**

```typescript
server: {
  host: "127.0.0.1",  // Localhost only
  port: 3000,
}
```

**Effort:** 5 minutes  
**Files to Modify:** `vite.config.ts`

---

## 🟠 P1 - HIGH PRIORITY GAPS (This Week)

### 6. **No E2E Testing**

**Severity:** 🟠 High  
**Issue:** No Playwright/Cypress tests for critical user flows.  
**Impact:** UI regressions, broken user journeys undetected.  
**Recommendation:** Implement Playwright for:

- Wallet creation flow
- Transaction signing
- Biometric authentication
- Cross-platform behavior
**Effort:** 8 hours  
**Files to Create:** `tests/e2e/*.spec.ts`, `.github/workflows/e2e.yml`

---

### 7. **No Pre-commit Hooks**

**Severity:** 🟠 High  
**Issue:** No automated quality checks before commits.  
**Impact:** Inconsistent code style, secrets may be committed.  
**Recommendation:**

```bash
npm install -D husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

**Effort:** 30 minutes  
**Files to Create:** `.husky/pre-commit`, `.lintstagedrc`

---

### 8. **No Code Splitting**

**Location:** `App.tsx` (23,703 bytes)  
**Severity:** 🟠 High  
**Issue:** Single bundle imports all components. Large initial load.  
**Impact:** Slow first paint, poor mobile performance.  
**Recommendation:** Implement React.lazy() + Suspense for route-based splitting.  
**Effort:** 4 hours  
**Files to Modify:** `App.tsx`, route definitions

---

### 9. **Missing TypeScript Strictness**

**Location:** `tsconfig.json`  
**Severity:** 🟠 High  
**Issue:** Missing strict options that catch common errors.  
**Impact:** Runtime errors that could be caught at compile time.  
**Recommendation:**

```json
{
  "compilerOptions": {
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Effort:** 2 hours (plus fixing new errors)  
**Files to Modify:** `tsconfig.json`

---

### 10. **No Content Security Policy**

**Location:** `vite.config.ts`  
**Severity:** 🟠 High  
**Issue:** No CSP headers to prevent XSS/injection attacks.  
**Impact:** XSS vulnerabilities, script injection risks.  
**Recommendation:** Add CSP middleware:

```typescript
// vite.config.ts
server: {
  headers: {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  }
}
```

**Effort:** 30 minutes  
**Files to Modify:** `vite.config.ts`

---

### 11. **No Error Boundary Coverage**

**Severity:** 🟠 High  
**Issue:** Only one ErrorBoundary component, not wrapping all routes.  
**Impact:** Crash cascades, poor UX when errors occur.  
**Recommendation:** Wrap all routes with ErrorBoundary, add logging integration (Sentry).  
**Effort:** 4 hours  
**Files to Modify:** Route definitions, `App.tsx`

---

### 12. **No Request Deduplication**

**Location:** `services/gemini.ts`, `services/protocol.ts`  
**Severity:** 🟠 High  
**Issue:** Likely duplicate API calls, no caching strategy.  
**Impact:** Unnecessary network requests, rate limiting, poor performance.  
**Recommendation:** Implement React Query (TanStack Query) for caching/deduplication.  
**Effort:** 8 hours  
**Files to Modify:** Service files, add `@tanstack/react-query` dependency

---

### 13. **No Input Validation**

**Location:** `components/PaymentPortal.tsx`, `components/Onboarding.tsx`  
**Severity:** 🟠 High  
**Issue:** No sanitization on mnemonic/seed input fields.  
**Impact:** XSS/Injection attacks via crafted inputs.  
**Recommendation:**

- Add input sanitization
- Validate mnemonic word count
- Check for suspicious patterns
**Effort:** 4 hours  
**Files to Modify:** Input components, add validation utilities

---

## 🟡 P2 - MEDIUM PRIORITY GAPS (Next 2 Weeks)

### 14. **No Service Worker**

**Severity:** 🟡 Medium  
**Issue:** No offline capability, no PWA install prompt.  
**Impact:** App requires constant connectivity, no offline functionality.  
**Recommendation:** Add Vite PWA plugin for offline caching and background sync.  
**Effort:** 4 hours  
**Files to Create:** `vite.config.ts` modifications

---

### 15. **No Bundle Analysis**

**Severity:** 🟡 Medium  
**Issue:** Can't identify oversized dependencies.  
**Impact:** Unknown performance bottlenecks.  
**Recommendation:** Add `vite-bundle-analyzer` to build process.  
**Effort:** 30 minutes  
**Files to Modify:** `vite.config.ts`

---

### 16. **No Analytics/Monitoring**

**Severity:** 🟡 Medium  
**Issue:** No error tracking, performance monitoring, or usage analytics.  
**Impact:** Blind to production issues and user behavior.  
**Recommendation:** Add Sentry for error tracking, Web Vitals for performance.  
**Effort:** 4 hours  
**Files to Create:** Monitoring service wrappers

---

### 17. **Mixed State Management**

**Severity:** 🟡 Medium  
**Issue:** React Context + localStorage + sessionStorage + SecureEnclave mixed.  
**Impact:** No single source of truth, potential sync issues.  
**Recommendation:** Implement Zustand for global state management.  
**Effort:** 8 hours  
**Files to Modify:** Context providers, state consumers

---

### 18. **No Loading State Consistency**

**Severity:** 🟡 Medium  
**Issue:** No standardized loading/skeleton component pattern.  
**Impact:** Inconsistent UX across components.  
**Recommendation:** Create reusable Skeleton, Loading, and Error components.  
**Effort:** 4 hours  
**Files to Create:** `components/ui/*.tsx`

---

### 19. **No Database Migration Strategy**

**Severity:** 🟡 Medium  
**Issue:** Local storage changes could break existing users.  
**Impact:** Data loss for existing users on updates.  
**Recommendation:** Implement versioned storage schema with migration logic.  
**Effort:** 8 hours  
**Files to Create:** `services/storage-migration.ts`

---

### 20. **No Health Check Endpoint**

**Severity:** 🟡 Medium  
**Issue:** No `/health` or `/status` for monitoring wallet health.  
**Impact:** Can't monitor service availability programmatically.  
**Recommendation:** Add health check utility that tests critical dependencies.  
**Effort:** 2 hours  
**Files to Create:** `services/health-check.ts`

---

### 21. **Unused Files in Repository**

**Location:** `cleanup_payment_portal.py`, `update_payment_portal.py`, `gradle-build.log`  
**Severity:** 🟡 Medium  
**Issue:** Dead files cluttering repository.  
**Recommendation:** Delete or move to `scripts/` with documentation.  
**Effort:** 15 minutes  
**Action:** Delete or relocate

---

### 22. **No API Documentation**

**Severity:** 🟡 Medium  
**Issue:** No typedoc or API reference for services.  
**Impact:** Steep learning curve for new developers.  
**Recommendation:** Add TypeDoc generation to build process.  
**Effort:** 4 hours  
**Files to Create:** Documentation generation scripts

---

### 23. **No Storybook for Components**

**Severity:** 🟡 Medium  
**Issue:** No isolated component development/testing environment.  
**Impact:** Difficult to develop/test UI components in isolation.  
**Recommendation:** Add Storybook for component documentation and testing.  
**Effort:** 4 hours  
**Files to Create:** `.storybook/`, component stories

---

### 24. **Test Environment Mismatch**

**Location:** `vite.config.ts`  
**Severity:** 🟡 Medium  
**Issue:** Uses Node environment instead of JSDOM for DOM tests.  
**Recommendation:**

```typescript
// Should be:
environment: "jsdom"  // not "node"
```

**Effort:** 30 minutes  
**Files to Modify:** `vite.config.ts`

---

### 25. **No Lockfile Consistency Check**

**Severity:** 🟡 Medium  
**Issue:** `package-lock.json` not verified in CI.  
**Impact:** Dependency drift between environments.  
**Recommendation:** Add lockfile verification to CI workflow.  
**Effort:** 30 minutes  
**Files to Modify:** `.github/workflows/ci.yml`

---

## 🟢 P3 - LOW PRIORITY GAPS (Next Month)

### 26. **Outdated Dependencies**

**Severity:** 🟢 Low  
**Issue:** No Dependabot or automated dependency updates.  
**Recommendation:** Enable Dependabot for automated PRs.  
**Effort:** 30 minutes  
**Files to Create:** `.github/dependabot.yml`

---

### 27. **No Development Onboarding Guide**

**Severity:** 🟢 Low  
**Issue:** No `DEVELOPMENT.md` with setup instructions.  
**Recommendation:** Create comprehensive setup guide with troubleshooting.  
**Effort:** 4 hours  
**Files to Create:** `DEVELOPMENT.md`

---

### 28. **No Architectural Decision Records**

**Severity:** 🟢 Low  
**Issue:** No ADRs documenting why architectural choices were made.  
**Recommendation:** Create `docs/adr/` folder with decision records.  
**Effort:** 8 hours (backfill + ongoing)  
**Files to Create:** `docs/adr/*.md`

---

### 29. **No Performance Budgets**

**Severity:** 🟢 Low  
**Issue:** No defined limits for bundle size, load time.  
**Recommendation:** Add Lighthouse CI and bundle size limits.  
**Effort:** 4 hours  
**Files to Create:** `.github/lighthouse.yml`, budget config

---

### 30. **No Security Audit Trail**

**Severity:** 🟢 Low  
**Issue:** No documentation of security reviews or penetration tests.  
**Recommendation:** Create `SECURITY_AUDITS.md` with review history.  
**Effort:** 2 hours  
**Files to Create:** `SECURITY_AUDITS.md`

---

## 📊 SUMMARY METRICS

| Category | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| **Security** | 3 | 2 | 1 | 0 | 6 |
| **CI/CD** | 1 | 2 | 0 | 0 | 3 |
| **Testing** | 1 | 1 | 2 | 0 | 4 |
| **Performance** | 1 | 1 | 2 | 1 | 5 |
| **Documentation** | 0 | 0 | 3 | 3 | 6 |
| **Architecture** | 0 | 2 | 4 | 1 | 7 |
| **TOTAL** | **5** | **8** | **12** | **5** | **30** |

---

## 🎯 RECOMMENDED EXECUTION ORDER

### Week 1 (Immediate)

1. Fix `.gitignore` (P0 #2) - 5 min
2. Pin dependencies (P0 #4) - 5 min
3. Fix Vite host (P0 #5) - 5 min
4. Create CI workflow (P0 #3) - 30 min
5. Start core service tests (P0 #1) - ongoing

### Week 2-3

6. Add pre-commit hooks (P1 #7)
2. Implement code splitting (P1 #8)
3. Add TypeScript strictness (P1 #9)
4. Add CSP headers (P1 #10)

### Month 2

10. E2E testing setup (P1 #6)
2. Error boundaries (P1 #11)
3. Request deduplication (P1 #12)
4. Input validation (P1 #13)

---

## 🆕 NEWLY DISCOVERED GAPS (2026-02-10 Code Review)

### 31. **NTT Bridge Execution is Mocked**

**Location:** `services/ntt.ts:33-57`  
**Severity:** 🟠 High (P1)  
**Issue:** `executeBridge()` returns a random mock tx hash. No real Wormhole SDK signing, VAA retrieval, or destination redemption.  
**Impact:** Users cannot perform real cross-chain transfers. PRD FR-NTT-01 not met.  
**Status:** Gated with `NTT_EXPERIMENTAL` flag and console warnings (2026-02-10).  
**Recommendation:** Integrate Wormhole NTT SDK for real source signing + VAA polling + destination redemption.  
**Effort:** 40 hours

---

### 32. **Changelly Swap Returns Fake PayinAddress**

**Location:** `services/swap.ts:76-95`  
**Severity:** 🟠 High (P1)  
**Issue:** `createChangellyTransaction()` returns `bc1qchangellymockpayinaddress...`. If UI doesn't block, users could send funds to non-existent address.  
**Impact:** Potential fund loss if experimental guard fails.  
**Status:** Gated with `SWAP_EXPERIMENTAL` flag and console warnings (2026-02-10).  
**Recommendation:** Integrate Changelly API v2 or block the transaction creation UI entirely until real API is connected.  
**Effort:** 16 hours

---

### 33. **Silent Payments UI Uses Mock Seed**

**Location:** `components/SilentPayments.tsx:23`  
**Severity:** 🟠 High (P1)  
**Issue:** `Buffer.alloc(64, 0)` used instead of real seed from vault. Silent Payment addresses derived from zero-seed are deterministic and insecure.  
**Impact:** Any SP address displayed is useless/insecure.  
**Recommendation:** Decrypt actual seed from vault via PIN and derive real SP keys.  
**Effort:** 4 hours

---

### 34. **Google Fonts CDN Breaks Offline-First**

**Location:** `index.html:11-13`  
**Severity:** 🟡 Medium (P2)  
**Issue:** Inter and JetBrains Mono loaded from `fonts.googleapis.com`. Breaks NFR-REL-01 (offline capability) and leaks IP to Google on every launch.  
**Recommendation:** Download font files to `/public/fonts/` and update CSS references.  
**Effort:** 1 hour

---

### 35. **Root/Jailbreak Detection Missing**

**Location:** N/A (not implemented)  
**Severity:** 🟡 Medium (P2)  
**Issue:** PRD NFR-SEC-03 requires root detection. No SafetyNet/Play Integrity API integration exists.  
**Impact:** Rooted devices can access Keystore keys outside the TEE boundary.  
**Recommendation:** Integrate Play Integrity API for device attestation.  
**Effort:** 8 hours

---

### 36. **Non-BTC Fee Estimation Uses Hardcoded Mocks**

**Location:** `services/FeeEstimator.ts:14-22`  
**Severity:** 🟡 Medium (P2)  
**Issue:** `MOCK_FEES` object has hardcoded fee rates for Stacks, RSK, Liquid, Wormhole, and swap. Only BTC fetches real-time from mempool.space.  
**Recommendation:** Fetch real fee rates from each chain's API (Hiro for STX, RSK node for gas, etc.).  
**Effort:** 8 hours

---

### 37. **Runes Balance Always Returns Empty**

**Location:** `services/protocol.ts:83-88`  
**Severity:** 🟡 Medium (P2)  
**Issue:** `fetchRunesBalances()` always returns `[]`. No API integration for Runes data.  
**Recommendation:** Integrate Unisat or MagicEden API for Runes balance data.  
**Effort:** 8 hours

---

## 📝 NOTES

- Original 30 gaps verified through code review (2026-02-07)
- Gaps 31-37 discovered during full repo review (2026-02-10)
- All 5 P0 gaps resolved as of 2026-02-10
- See `IMPLEMENTATION_REGISTRY.md` for comprehensive real vs mocked vs missing feature status
- Architecture: Conclave TEE + Partner model (approved)

**Maintained by:** Cascade AI Agent  
**Review Cycle:** Weekly or on major changes  
**Next Review:** 2026-02-14
