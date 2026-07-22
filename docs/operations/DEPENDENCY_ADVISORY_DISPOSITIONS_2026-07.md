# Dependency Advisory Dispositions — 2026-07-22

**Issue:** [#399](https://github.com/Conxian/conxius-wallet/issues/399)
**Historical baseline:** `origin/main` at `ac5ee4651398162617d14b1c982ad977fbbffa57` (pre-#429/#433 snapshot)
**Current base:** `origin/main` at `493d2c0b397469e83f3d7ee5b78d40cdf365a727` after PR #429 and merged PR #433
**Candidate:** `charlie/399-refresh-post-merge-evidence`, a docs-only follow-up from current `main` on **2026-07-22**
**Status:** Proposed remediation evidence; this document does not record COO,
security-owner, or release approval.

## Result at a glance

The historical pre-remediation audit on **2026-07-22** reported six findings:
one high, two moderate, and three low. After PR #433 landed the `ajv`, `uuid`,
and `@babel/core` remediations, both the full and production audits on current
`main` report exactly three findings: one high and two low, with zero moderate
or critical findings. The remaining findings are the existing high
`bigint-buffer` exception plus the unresolved low `esbuild` and `elliptic`
advisories; issue #399 is not resolved by this documentation follow-up.

The high advisory remains production-reachable through the Wormhole/Solana
path. It is still covered only by the existing time-bounded exception, which
expires **2026-08-19**. No expiry extension, owner change, approval, or
not-affected determination is made here.

| Advisory | Severity | Before | After | Status / disposition |
| --- | --- | --- | --- | --- |
| `GHSA-3gc7-fjrx-p6mg` (`bigint-buffer`) | High | Present | Present | Existing exception remains active; pending COO/security approval; no published fixed release. |
| `GHSA-2g4f-4pwh-qvx6` (`ajv`) | Moderate | Present | Absent | Fixed with a targeted DWN override to published `8.18.0`; pending normal security/dependency review. |
| `GHSA-w5hq-g745-h8pq` (`uuid`) | Moderate | Present | Absent | Fixed with exact global `11.1.1` after CJS/ESM consumer compatibility checks; pending normal security/dependency review. |
| `GHSA-g7r4-m6w7-qqqr` (`esbuild`) | Low | Present | Present | Published `0.28.1` was tested but rejected: it breaks the production build through `vite-plugin-top-level-await`; no safe override is applied. |
| `GHSA-4x5r-pxfx-6jf8` (`@babel/core`) | Low | Present | Absent | Fixed with exact workspace override `7.29.6`; pending normal security/dependency review. |
| `GHSA-848j-6mx2-7j84` (`elliptic`) | Low | Present | Present | Unresolved and unsuppressed; no published `6.6.2`; pending security/dependency and release review. |

## Per-advisory evidence

### `GHSA-3gc7-fjrx-p6mg` — `bigint-buffer` (high)

- **Path/runtime surface:** `@wormhole-foundation/sdk` → Solana SDK →
  `@solana/spl-token` → `@solana/buffer-layout-utils` → `bigint-buffer@1.1.5`.
  The path is production-reachable; this branch does not claim otherwise.
- **Fix/exception state:** No published `bigint-buffer@1.1.6` or later release
  is available. The existing exception in
  `scripts/ci/dependency-audit-exceptions.json` remains unchanged in owner and
  expiry and is **pending COO/security approval**, not approved by this PR.
- **Owner/review:** Conxian security maintainers; COO/security review is
  required before release promotion and before the exception expires.
- **Expiry/recheck:** Hard expiry **2026-08-19**; recheck upstream availability
  and the affected path by **2026-08-05**. Never silently extend the expiry.
- **Compensating controls:** The lockfile remains pinned; CI runs
  `scripts/ci/audit_with_exceptions.mjs`, which validates the exact advisory,
  severity, owner, and expiry; frozen installs prevent lockfile drift; release
  promotion remains review-gated. The `bigint-buffer` build allowlist is not
  treated as a security fix.
- **Removal criteria:** Remove the exception only after a published fixed
  release is installed and verified, or after an explicitly reviewed fork/path
  replacement passes clean-install, audit, native/build, and relevant
  Wormhole/Solana regression checks. Do not force a nonexistent version.

### `GHSA-2g4f-4pwh-qvx6` — `ajv` (moderate)

- **Path/runtime surface:** Web5/DWN schema validation through
  `@web5/api` → `@web5/agent` → `@tbd54566975/dwn-sdk-js@0.5.1` → `ajv`.
  ESLint's separate `ajv@6.15.0` tree is intentionally unchanged.
- **Fix state:** Fixed in the post-PR-#433 lockfile with the published exact
  version `8.18.0` using the scoped pnpm selector
  `@tbd54566975/dwn-sdk-js@0.5.1>ajv`.
- **Owner/review:** Conxian dependency maintainers; security/dependency PR
  review is required before merge. No exception approval is asserted.
- **Compensating controls:** The override is narrow, the lockfile is frozen in
  CI, and Web5/DWN focused tests plus AJV schema compilation were run.
- **Override removal criteria:** Remove the selector once the DWN parent
  publishes a compatible dependency range resolving to `ajv >=8.18.0`; rerun
  the Web5/DWN tests and both audit commands before removal.

### `GHSA-w5hq-g745-h8pq` — `uuid` (moderate)

- **Path/runtime surface:** The advisory spans DWN/Web5, `jayson`,
  `rpc-websockets@7` and `@9`, and `vite-plugin-top-level-await`; it reaches
  Web5, Wormhole/Solana, and Vite tooling through different parent trees.
- **Fix state:** Fixed in the post-PR-#433 lockfile with exact global `uuid@11.1.1`.
  An unconstrained `>=11.1.1` override was deliberately not used because it
  could select a future ESM-only major.
- **Compatibility evidence:** Each affected parent resolved CJS `v1`, `v4`,
  and `v5`; the ESM build exported the same functions; imports of Web5,
  Solana, Wormhole, and Wormhole-Solana succeeded; focused Web5/Wormhole tests
  passed; the full suite passed 74 files with 347 tests passed and 1 skipped.
- **Owner/review:** Conxian dependency maintainers; security/dependency PR
  review is required before merge. No exception approval is asserted.
- **Compensating controls:** Exact pinning, frozen lockfile installation,
  parent-specific API smoke tests, and the full unit/build gates prevent a
  silent major drift.
- **Override removal criteria:** Remove the global override when all affected
  parents declare or resolve `uuid >=11.1.1` without it, after repeating the
  CJS/ESM and Web5/Solana/Wormhole compatibility checks.

### `GHSA-g7r4-m6w7-qqqr` — `esbuild` (low)

- **Path/runtime surface:** Vite/Vitest and related plugins use esbuild as a
  development/build tool; it is not a production application runtime package.
- **Fix state:** Unresolved and unsuppressed. Published `esbuild@0.28.1` was
  experimentally installed, but the production build failed in
  `vite-plugin-top-level-await@1.6.0` while transforming its generated bundle
  for Vite's existing browser target (`chrome87`, `edge88`, `firefox78`,
  `safari14`, `es2020`). The registry has no later esbuild release to test.
- **Safety decision:** Current main does not force `0.28.1`. Setting the Vite
  target to `es2021` makes the build pass, but changes browser compatibility and
  is not a narrowly justified dependency-only remediation. The branch retains
  the baseline `esbuild@0.27.3` lock resolution so the current build remains
  green; the advisory remains visible to audit.
- **Owner/review:** Conxian dependency maintainers; security/dependency and
  release review are required before promotion. No exception approval is
  asserted.
- **Recheck:** Recheck `vite-plugin-top-level-await`, Vite, and esbuild
  compatibility by **2026-08-19**, or earlier if a published fixed release is
  available.
- **Compensating controls:** Frozen install, deterministic baseline lockfile,
  `pnpm why esbuild`, clean production build, and explicit rejection of a
  browser-target change prevent the advisory from being hidden behind an
  unreviewed compatibility tradeoff.
- **Removal criteria:** Resolve when a published fixed esbuild release works
  with the current Vite/top-level-await/browser target, or after an explicitly
  reviewed Vite/plugin/configuration change preserves the required browser
  support and passes build, unit, and release gates. Do not treat a target
  narrowing or advisory suppression as a fix.

### `GHSA-4x5r-pxfx-6jf8` — `@babel/core` (low)

- **Path/runtime surface:** `eslint-plugin-react-hooks@7.1.1` and its Babel
  helper graph; lint-time tooling only.
- **Fix state:** Fixed with exact workspace override `@babel/core: 7.29.6`, a
  published fixed version. The lockfile also records the compatible Babel
  helper updates selected by that package.
- **Owner/review:** Conxian dependency maintainers; normal security/dependency
  review is required before merge. Current main uses the TypeScript `6.0.3`
  compatibility bridge restored by PR #429; no TypeScript 7 migration or
  approval is asserted here.
- **Compensating controls:** Exact pinning, frozen install, a direct Babel
  transform smoke check, and current lint verification (`0` errors, `630`
  warnings).
- **Override removal criteria:** Remove the override when the parent package
  naturally resolves a fixed `@babel/core >=7.29.1` release; rerun lint and
  audit verification.

### `GHSA-848j-6mx2-7j84` — `elliptic` (low)

- **Path/runtime surface:** Primarily Wormhole CosmWasm → CosmJS crypto and
  the legacy payjoin-client → bitcoinjs-lib → tiny-secp256k1 chain. Both are
  retained in the lock graph; this branch does not claim not affected.
- **Fix/exception state:** No published `elliptic@6.6.2` is available. No
  blanket override, suppression, or exception was added.
- **Owner/review:** Conxian dependency and security maintainers; affected
  protocol/release review is required before promotion. No approval is
  asserted.
- **Recheck:** Recheck published releases, compatible Wormhole/CosmJS updates,
  and parent-path isolation by **2026-08-19**.
- **Compensating controls:** The vulnerable version remains visible to audit;
  the lockfile is deterministic; dependency-review and release review remain
  required; `pnpm why elliptic` is part of the verification record.
- **Removal criteria:** Resolve through a published fixed release, a
  compatible parent upgrade that removes the legacy path, or a reviewed fork /
  feature-isolation change with cryptographic regression coverage. Do not force
  an unpublished version.

## Clean verification record

Recorded on **2026-07-22** from the docs-only follow-up branch based on
`origin/main` at `493d2c0b397469e83f3d7ee5b78d40cdf365a727`, after PR #433:

```text
CI=true pnpm install --frozen-lockfile
pnpm audit --audit-level=low --json
pnpm audit --prod --audit-level=low --json
pnpm exec node scripts/ci/audit_with_exceptions.mjs
pnpm run check:typescript-compat
pnpm run lint
pnpm exec tsc --noEmit
pnpm test --run
pnpm run build
pnpm exec vitest run tests/ci/release-artifact-policy.test.mjs tests/ci/release-version.test.mjs tests/ci/release-workflow-policy.test.mjs tests/ci/workflow-pins.test.mjs
CI=true pnpm run test:e2e
```

The frozen install completed without lockfile changes. Both audit commands
reported exit `1` with exactly three findings —
`GHSA-3gc7-fjrx-p6mg` (`bigint-buffer@1.1.5`, high),
`GHSA-g7r4-m6w7-qqqr` (`esbuild@0.27.3`, low), and
`GHSA-848j-6mx2-7j84` (`elliptic@6.6.1`, low). The exception wrapper passed its
high/critical policy with one active exception expiring 2026-08-19. A passing
wrapper is not approval for the remaining issue-level dispositions.

Final validation on the same branch also recorded:

- `pnpm why` for all six packages: completed; the fixed trees resolve
  `ajv@6.15.0` and `8.18.0`, `uuid@11.1.1`, and `@babel/core@7.29.6`;
  unresolved trees remain visible as `esbuild@0.27.3`,
  `bigint-buffer@1.1.5`, and `elliptic@6.6.1`.
- `pnpm run check:typescript-compat`: passed; the approved TypeScript version
  is `6.0.3`.
- TypeScript compatibility tests: passed — 6 tests.
- `pnpm run lint`: passed — 0 errors, 630 warnings.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm test --run`: passed — 74 files, 347 tests passed, 1 skipped.
- Focused Web5/NTT/AI-security tests: passed — 3 files, 17 tests.
- `pnpm run build`: passed — 4,760 modules transformed.
- Release policy gate
  (`tests/ci/release-artifact-policy.test.mjs`, `release-version.test.mjs`,
  `release-workflow-policy.test.mjs`, and `workflow-pins.test.mjs`): passed —
  25 tests.
- `CI=true pnpm run test:e2e`: passed — 30 Playwright tests.
- Direct dependency smoke checks: passed — UUID CJS/ESM `v1`/`v4`/`v5` exports,
  AJV schema compilation, Babel transform, and Web5/Wormhole/Wormhole-Solana
  imports.
