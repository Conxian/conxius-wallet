# Technical Debt Register — Release Baseline Hardening

**Authority:** Canonical technical-debt inventory for `Conxian/conxius-wallet`.
**Issue:** [#357](https://github.com/Conxian/conxius-wallet/issues/357)
**Current main reviewed:** 2026-07-22 at `d0d128bf829a902125e0b588bcac52e6eed5a37a` after merged PRs #441 and #442.
**Historical baseline:** The pre-#429 measurements below are retained as historical evidence where explicitly labeled; they do not describe the current main commit.
**Target milestone:** M16 / v1.9.5 release baseline, before production promotion.

This register is the source of truth for release-baseline debt. Historical audit
and status documents remain useful evidence, but their completion checkboxes do
not override the status recorded here. An item is only marked **Completed** when
its exit criteria and validation are recorded in the implementation change.

**Current JavaScript toolchain state (2026-07-22):** The supported integrated
lint path uses TypeScript `6.0.3` with `typescript-eslint` `8.65.0`. The TypeScript
`7.0.2` dual-toolchain migration remains open in [issue #396](https://github.com/Conxian/conxius-wallet/issues/396)
and is intentionally not hidden behind lint suppression or broad rule changes.

## Baseline measurements

| Measure | Baseline evidence | Interpretation |
| --- | --- | --- |
| Local pnpm | `10.28.1` | Disagreed with CI (`11.13.0`) and Android release (`10.30.3`); `package.json` had no `packageManager` declaration. |
| TypeScript / typescript-eslint | Historical pre-#429 snapshot: TypeScript `7.0.2`; `typescript-eslint` `8.65.0` supports `>=4.8.4 <6.1.0` | Current main and the post-PR-#433 candidate use the exact TypeScript `6.0.3` bridge; TypeScript 7 remains separate migration work under issue #396, not a current lint blocker. |
| Lint | Historical pre-#429 snapshot: `pnpm run lint` exited `2` during `typescript-eslint` initialization | Current candidate `pnpm run lint` passed with 0 errors and 630 warnings. |
| JavaScript tests | Historical pre-#429 snapshot: 61 files; 245 passed, 1 skipped; about 52s | PR #441 reported 76 files with 401 passed / 1 skipped on the merged feature delta. Existing tests still do not prove native hardware, backend verification, or protocol production paths. |
| Android configuration | Historical pre-#429 configuration failure | PRs #441/#442 report the focused Gradle tasks were blocked before execution because this devbox has no Android SDK; hosted CI is separate from real-device qualification. |
| CI artifacts | Historical pre-#429 upload mismatch | The remediation is recorded as completed in TD-P1-007; current job/artifact behavior still requires hosted-run evidence when changed. |
| Scheduled cleanup | Historical pre-#429 runner-local cleanup workflow | The no-op cleanup was removed; this row is not a current open debt. |
| Static debt scan | Historical directional scan: 62 console calls, 131 explicit `any` matches, 66 placeholder/simulation/stub/mock/TODO markers across production paths | Broad hygiene debt remains; counts must be regenerated before burn-down claims. |
| Active npm command/config scan | Historical active-command/config mismatch | Active paths were updated; historical documentation may still require classification under TD-P2-010. |

## Issue #357 branch checkpoint (historical #429 evidence)

The following table records the earlier toolchain-restore checkpoint from PR
#429. Current post-PR-#433 results are recorded in TD-P1-005 and the dependency
disposition document below; the historical TypeScript 7/lint values are not
current candidate results.

| Validation | Result | Timing / metric |
| --- | --- | --- |
| Frozen dependency install | Passed with `CI=true corepack pnpm install --frozen-lockfile` | About 2s; pnpm `11.13.0`; lockfile remained unchanged. Security overrides are sourced from `pnpm-workspace.yaml` because pnpm 11 ignores the obsolete `package.json` `pnpm` field. |
| ESLint | Passed | About 28s; 0 errors, 667 warnings. The unsupported-TypeScript crash is gone. |
| TypeScript | Passed with `corepack pnpm exec tsc --noEmit` | About 30s. |
| Signer regression | Passed with `corepack pnpm exec vitest run tests/signer.test.ts tests/enclave-storage.test.ts tests/signer-native-boundary.test.ts` | 3 files; 57/57 tests, about 5s. Coverage includes real enclave availability/plugin rejection and native batch failure paths with no worker fallback. |
| Full Vitest | Passed | 62 files; 250 passed, 1 skipped; about 35s. |
| Runtime contamination guard | Passed | About 0s. |
| Android configuration | Passed with `./gradlew --no-daemon :app:tasks --all` | About 35s; AGP 9 Kotlin/Compose configuration accepted. |
| Android unit tests | Blocked | About 12s; no Android SDK or `ANDROID_HOME`/`ANDROID_SDK_ROOT` in the devbox. |
| Closest release task | Blocked | `./gradlew --no-daemon :app:assembleRelease`; about 18s; same missing SDK blocker before signing. |
| Web production build | Blocked by environment | TypeScript completed, then Vite was killed with exit `137` during chunk rendering after 4,736 modules transformed. |
| Repository verify | Blocked by web production build | Tests and lint completed; Vite again exited `137` during chunk rendering. |
| Capacitor sync | Blocked by missing build output | `corepack pnpm exec cap sync android` exited 1 because `./dist/index.html` is absent; the authoritative root config uses `npmClient: pnpm`, while the tracked generated asset was reverted to its prior state because no successful sync was produced. |
| Dependency audit | Default CI passes with explicit pending-approval warnings; release gate blocks | `pnpm audit --audit-level=low --json` reports three residual findings: pending exceptions for `bigint-buffer@1.1.5` and `elliptic@6.6.1`, plus a production/release `not-affected` disposition for `esbuild@0.27.3`. The ledger and temp evidence artifact are enforced by `scripts/ci/audit_with_exceptions.mjs`; release mode blocks until both exceptions are approved. |

## Inventory

### TD-P0-001 — Native signing must fail closed

- **Category:** Native signing / security boundary
- **Priority:** P0
- **Status:** Completed
- **Affected paths:** `services/signer.ts`, `services/enclave-storage.ts`, `tests/signer.test.ts`, `tests/signer-native-boundary.test.ts`
- **Impact:** A native enclave failure previously fell through to the TypeScript worker, allowing a production/native signing request to continue outside the required enclave boundary.
- **Owner:** Unassigned
- **Exit criteria:** Native-platform signing errors reject the request, do not invoke `workerManager`, and retain an explicitly supported software path only for web/test environments.
- **Validation:** `corepack pnpm exec vitest run tests/signer.test.ts tests/enclave-storage.test.ts tests/signer-native-boundary.test.ts` passed 57/57. The real `enclave-storage` boundary is exercised for unavailable/rejected native availability, plugin signing rejection, and batch-signing rejection; each asserts no `workerManager.derivePath` call and the batch case also asserts no PSBT finalization. Full Vitest passed 62 files with 250 passed and 1 skipped.
- **Target milestone:** M16 release baseline
- **Metrics baseline:** Native failure fallback was present; no regression test asserted worker non-invocation.
- **Evidence:** `services/signer.ts`; `docs/reports/v1.9.5_CODE_GAP_MAPPING.md`; [issue #357](https://github.com/Conxian/conxius-wallet/issues/357)

### TD-P0-002 — Native manager coverage versus synthetic protocol success paths

- **Category:** Native bridge / protocol integrity
- **Priority:** P0
- **Status:** Open — BitVM2 quarantine tracked by issue #427
- **Affected paths:** `android/core-bitcoin/src/main/kotlin/com/conxius/wallet/bitcoin/`, `services/ark.ts`, `services/bitvm.ts`, `services/rgb.ts`, `services/ntt.ts`, `services/lightning.ts`
- **Impact:** Several protocol paths are described as bridged or production-ready while reports identify stubs, simulations, placeholder cryptography, or incomplete native implementations. Synthetic success can mask unsupported production operations. BitVM2 specifically had boolean/synthetic verification and signing shapes; issue #427 replaces those with typed fail-closed outcomes and a canonical proof-envelope gate.
- **Owner:** Unassigned
- **Exit criteria:** Every production-capable protocol operation has a verified native implementation or an explicit fail-closed guard; tests distinguish simulation from production and cannot report synthetic success as production readiness.
- **Validation:** Protocol-by-protocol evidence review, native unit/instrumentation tests, and negative tests for unsupported production operations. BitVM2 requires arbitrary/malformed/wrong-key/mutated/encoding/tap-index/binding cases, explicit non-authoritative simulation labels, and proof that unsupported/simulated/caller-fabricated verified results never invoke a signer.
- **PR #390 evidence:** The draft adds a bounded BIP-352 Rust/JNI scanner, Kotlin Esplora source, persistence/cursor coordination, shallow reorg fail-closed checks, and focused source/codec/manager tests. It does not close this broader debt: Android release validation, device evidence, compact filters, spending/tweak recovery, address encoding, and other protocol gaps remain open.
- **Target milestone:** M16 release baseline gate, then M17 protocol completion
- **Metrics baseline:** `docs/reports/GAP_MATRIX_2026.md` lists seven protocol gaps; `docs/reports/v1.9.5_CODE_GAP_MAPPING.md` maps native and service-layer stubs.
- **Evidence:** [`GAP_MATRIX_2026.md`](../reports/GAP_MATRIX_2026.md); [`v1.9.5_CODE_GAP_MAPPING.md`](../reports/v1.9.5_CODE_GAP_MAPPING.md); [`GAPS_AND_RECOMMENDATIONS_ROUND_2.md`](../archive/GAPS_AND_RECOMMENDATIONS_ROUND_2.md)

### TD-P0-003 — Android release configuration and signing reproducibility

- **Category:** Android release / supply chain
- **Priority:** P0
- **Status:** Open
- **Affected paths:** `android/app/build.gradle.kts`, `android/gradle/`, `.github/workflows/android-release.yml`, `docs/operations/ANDROID_RELEASE_PREP.md`
- **Impact:** The release workflow depends on external signing material and has not been proven in this environment. A release baseline must produce a verifiable AAB/APK without weakening secret handling or silently falling back to unsigned output.
- **Owner:** Unassigned
- **Exit criteria:** `:app:bundleRelease` succeeds with authorized signing material in CI; the closest unsigned/non-publishing release task is documented when local secrets are unavailable; artifact paths and checksums are verified.
- **Validation:** `./gradlew :app:bundleRelease` in a signing-enabled environment, or a documented closest release task plus CI evidence; secret scan and generated-artifact review.
- **Target milestone:** M16 release candidate
- **Metrics baseline:** Local checkout has no release keystore; release workflow decodes `KEYSTORE_BASE64` to `${RUNNER_TEMP}` and passes signing variables.
- **Evidence:** [`ANDROID_RELEASE_PREP.md`](ANDROID_RELEASE_PREP.md); `.github/workflows/android-release.yml`; `android/app/build.gradle.kts`

### TD-P0-004 — AGP 9 built-in Kotlin migration and obsolete Jetifier

- **Category:** Android toolchain
- **Priority:** P0
- **Status:** In Progress — configuration gate passed; SDK-dependent tests remain blocked.
- **Affected paths:** `android/build.gradle.kts`, `android/app/build.gradle.kts`, `android/core-*/build.gradle.kts`, `android/gradle/libs.versions.toml`, `android/gradle.properties`
- **Impact:** AGP `9.3.0` rejects the redundant `org.jetbrains.kotlin.android` plugin; Jetifier is deprecated and adds needless build work.
- **Owner:** Unassigned
- **Exit criteria:** Root and module Kotlin plugin declarations are removed, Jetifier is disabled, and Android configuration plus requested unit tests pass without speculative version changes.
- **Validation:** `./gradlew --no-daemon :app:tasks --all` passed after removing the redundant Kotlin plugin, migrating `kotlinOptions` to `compilerOptions`, and applying the required Compose compiler plugin. PR #390's Compose scan card is source-integrated, but `./gradlew --no-daemon :app:testDebugUnitTest :core-bitcoin:test` and Android compilation remain blocked by the missing Android SDK.
- **Target milestone:** M16 release baseline
- **Metrics baseline:** Configuration failed before task discovery; AGP emitted an `android.enableJetifier=true` deprecation warning.
- **Evidence:** AGP configuration error captured during #357 investigation; `android/gradle/libs.versions.toml`; [`ANDROID_SDK_REVIEW.md`](../reports/ANDROID_SDK_REVIEW.md)

### TD-P0-013 — Android KeyMint / StrongBox and Play Integrity qualification

- **Category:** Android attestation / value-operation authorization
- **Priority:** P0
- **Status:** In Progress — client collection and request binding are merged; real-device qualification, backend verification, durable freshness/replay policy, centralized enforcement, rollout controls, and independent review remain open.
- **Affected paths:** `android/core-crypto/src/main/kotlin/com/conxius/wallet/crypto/KeySecurityPolicy.kt`, `android/core-crypto/src/main/kotlin/com/conxius/wallet/crypto/KeyMintAuthorizationManager.kt`, `android/core-crypto/src/main/kotlin/com/conxius/wallet/crypto/AuthorizationRequest.kt`, `android/app/src/main/kotlin/com/conxius/wallet/PlayIntegrityPlugin.kt`, `docs/reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md`
- **Impact:** Client-side KeyMint evidence and Play Integrity token acquisition can be mistaken for hardware qualification, server verification, or protocol-signing authorization. That would permit false release claims or an unenforced value-operation boundary.
- **Owner:** Unassigned
- **Exit criteria:** The qualification matrix in the canonical report passes on real StrongBox, TEE-only, legacy API, unsupported, and relevant Play installation states; a trusted backend verifies Android Key Attestation chain/root/revocation/challenge/app identity/key profile/security level/verified-boot/patch state; the backend decrypts and verifies Play Integrity and compares package/signing identity/request hash/timestamp/verdict policy; durable nonce/operation consumption and freshness prevent replay/cross-operation reuse; every value operation uses the centralized gate and fails closed on missing, stale, unverifiable, or outage states; privacy-minimized telemetry and staged rollout/rollback/outage procedures are reviewed; and independent security review/release acceptance is recorded.
- **Validation:** PR #441 merged the KeyMint policy/evidence/canonical-binding client slice; PR #442 merged Play Integrity SDK `1.6.0` opaque-token acquisition. Local Android Gradle tests remain SDK-blocked in this devbox. No client/unit/hosted CI result is accepted as hardware qualification or backend verification.
- **Target milestone:** M16 release baseline gate
- **Metrics baseline:** Client boundary present; backend verifier, real-device evidence matrix, centralized production gate, privacy-minimized telemetry, staged rollout/runbook, and independent acceptance are not delivered by this change.
- **Evidence:** [`CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md`](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md); [PR #441](https://github.com/Conxian/conxius-wallet/pull/441); [PR #442](https://github.com/Conxian/conxius-wallet/pull/442); [CON-1543](https://linear.app/conxian-labs/issue/CON-1543/p0-operationalize-attestation-roots-collateral-revocation-and); [CON-1512](https://linear.app/conxian-labs/issue/CON-1512/p0-enforce-hardware-backed-signing-and-mandatory-attestation-for-value); [CON-1546](https://linear.app/conxian-labs/issue/CON-1546/p0-add-centralized-wallet-value-operation-gate-and-quarantine); [CON-1519](https://linear.app/conxian-labs/issue/CON-1519/p0-complete-independent-security-review-and-release-acceptance)

### TD-P1-005 — Deterministic JavaScript toolchain and lint compatibility

- **Category:** Toolchain / lint
- **Priority:** P1
- **Status:** In Progress — the approved TypeScript `6.0.3` bridge remains the programmatic/API lane; the TypeScript 7 dual-toolchain validation is source-integrated, while hosted CI review and COO approval remain before any TypeScript 7-only/default promotion.
- **Affected paths:** `package.json`, `pnpm-lock.yaml`, `tsconfig.ts6.json`, `tsconfig.ts7.json`, `scripts/ci/check_typescript_compatibility.mjs`, `tests/ci/typescript-compatibility.test.mjs`, `scripts/ci/verify_local.sh`, `scripts/ci/verify_typescript_dual_toolchain.mjs`, `.github/workflows/ci.yml`, `.github/workflows/android-release.yml`, `eslint.config.js`
- **Impact:** Local, CI, and release environments selected different pnpm versions, while PR #425 promoted TypeScript `7.0.2` outside `typescript-eslint` `8.65.0` support and crashed lint. The approved TypeScript 6 bridge must remain the programmatic/API runtime while the TypeScript 7 CLI stays available as an explicit migration lane.
- **Regression/remediation:** PR #425 introduced the TypeScript 7 regression on `main`; the bridge and repository-owned compatibility guard restore the supported lint/API runtime, validate the installed `typescript-eslint` peer range, and fail before lint, typecheck, or build when the contract drifts. No wallet or native runtime behavior is changed.
- **Owner:** Unassigned
- **Exit criteria:** `packageManager` declares pnpm `11.13.0`; CI/release/local verification select it through Corepack or the action; the manifest aliases the TypeScript 7 CLI separately from the exact TypeScript 6 bridge; the compatibility guard and smoke verifier prove the lockfile/API contract, installed `typescript-eslint` peer range, `tsc` 7, `tsc6` 6, and imported TypeScript API 6; both typechecks and lint pass without broad rule weakening; hosted Android/NDK/E2E gates remain intact; and COO approval is recorded before any TypeScript 7-only/default promotion.
- **Validation:** The dual-toolchain verifier reported `tsc` `7.0.2`, `tsc6` `6.0.3`, and imported TypeScript API `6.0.3`. On the post-PR-#433 candidate, `CI=true pnpm install --frozen-lockfile` passed with pnpm `11.13.0`; `pnpm run check:typescript-compat` passed for the TypeScript `6.0.3` bridge; focused compatibility tests passed 15/15; `pnpm run lint` passed with 0 errors and 630 warnings; `pnpm exec tsc --noEmit` passed; `pnpm test --run` passed 74 files with 347 passed and 1 skipped; `pnpm run build` passed after 4,760 modules transformed; release-policy tests passed 25/25; `CI=true pnpm run test:e2e` passed 30/30. TypeScript 7 remains an explicit migration lane under issue #396; hosted CI review and COO approval remain before any TypeScript 7-only/default promotion.
- **Target milestone:** M16 release baseline
- **Metrics baseline:** Historical pre-#429 snapshot recorded local `10.28.1`, CI `11.13.0`, release `10.30.3`, and TypeScript `7.0.2` lint exit `2`; the post-PR-#433 candidate records pnpm `11.13.0`, TypeScript `6.0.3` bridge compatibility, lint at 0 errors / 630 warnings, 74 files with 347 passed and 1 skipped, 4,760 build modules, release policy 25/25, and E2E 30/30.
- **Evidence:** [`CONTRIBUTING.md`](../../CONTRIBUTING.md); [`Sovereign_State.md`](../state/Sovereign_State.md); [`TYPESCRIPT_DUAL_TOOLCHAIN.md`](TYPESCRIPT_DUAL_TOOLCHAIN.md); `scripts/ci/check_typescript_compatibility.mjs`; `scripts/ci/verify_typescript_dual_toolchain.mjs`; `eslint.config.js`; [issue #396](https://github.com/Conxian/conxius-wallet/issues/396)

### TD-P1-006 — E2E and Android CI coverage

- **Category:** Test coverage / release confidence
- **Priority:** P1
- **Status:** Completed for named hosted CI job coverage; local SDK, real-device, and attestation qualification remain open under TD-P0-013.
- **Affected paths:** `.github/workflows/ci.yml`, `.github/workflows/android-release.yml`, `playwright.config.ts`, `e2e/`, `android/`
- **Impact:** The former baseline overstated the absence of CI coverage. Current workflows define named E2E, Android lint, and Android unit-test jobs; those jobs still do not prove physical-device StrongBox behavior, Play installation state, backend verification, or release authorization.
- **Owner:** Unassigned
- **Exit criteria:** CI has intentional, resource-bounded Playwright coverage and Android unit-test coverage; failure artifacts are produced by the jobs that upload them; release checks are separated from publishing.
- **Validation:** `.github/workflows/ci.yml` defines `E2E`, `Android Lint`, and `Android Unit Tests` jobs, and PRs #441/#442 record the hosted checks as passing. This satisfies job-presence coverage only; local Gradle execution in this devbox is blocked by the missing Android SDK, and no hosted job is a substitute for the TD-P0-013 device/backend matrix.
- **Target milestone:** M16 release baseline / M17 coverage expansion
- **Metrics baseline:** Historical baseline had no named E2E or Android test job; current workflow has named jobs and retained real-device/backend gaps.
- **Evidence:** `.github/workflows/ci.yml`; [`ANDROID_RELEASE_PREP.md`](ANDROID_RELEASE_PREP.md); [`MOBILE_TESTING_GUIDE.md`](MOBILE_TESTING_GUIDE.md)

### TD-P1-007 — CI artifact and runner-cleanup contracts

- **Category:** CI efficiency / observability
- **Priority:** P1
- **Status:** Completed
- **Affected paths:** `.github/workflows/ci.yml`, `.github/workflows/cleanup-artifacts.yml`
- **Impact:** CI attempted uploads for directories no job produced, and scheduled cleanup deleted only ephemeral runner-local state.
- **Owner:** Unassigned
- **Exit criteria:** No artifact upload exists without a producing job and explicit failure-artifact contract; the no-op cleanup workflow is removed or replaced with durable retention management.
- **Validation:** Removed the unproduced failure-artifact uploads and deleted the
  weekly runner-local cleanup workflow; the Web Build job now produces the
  `web-dist` artifact consumed by both Android CI jobs. Changed workflow files
  pass diff review. A remote CI run is still required to confirm hosted-runner
  behavior.
- **Target milestone:** M16 release baseline
- **Metrics baseline:** Four unproduced artifact paths and one weekly ephemeral-runner cleanup workflow.
- **Evidence:** [`CI_WORKFLOW_REMEDIATION_REPORT.md`](../reports/CI_WORKFLOW_REMEDIATION_REPORT.md); `.github/workflows/ci.yml`

### TD-P1-008 — Status-document and implementation-state mismatch

- **Category:** Documentation / governance
- **Priority:** P1
- **Status:** In Progress — current operational links and toolchain claims updated; historical completion claims still need classification.
- **Affected paths:** `docs/state/Sovereign_State.md`, `docs/operations/ROADMAP.md`, `docs/reports/v1.9.5_PRODUCTION_AUDIT.md`, `docs/archive/PROJECT_CONTEXT.md`
- **Impact:** Current state documents claim completed production readiness while the code and CI baseline still contain open release, protocol, and toolchain debt.
- **Owner:** Unassigned
- **Exit criteria:** Current operational/state docs link this register, use current toolchain facts, and do not mark open register items as verified; historical reports are clearly labeled as historical evidence.
- **Validation:** Documentation review against this register and current command output. On 2026-07-20, `Sovereign_State.md` records the verified GitHub snapshot of 4 open issues and 2 open PRs and labels PR #390's native BIP-352 work as draft/partial; release evidence remains open.
- **Target milestone:** M16 release baseline
- **Metrics baseline:** `Sovereign_State.md` reports pnpm `11.9.0`, TypeScript `6.0.3`, and all checks passing; the repository baseline measured different values and a lint crash.
- **Evidence:** [`Sovereign_State.md`](../state/Sovereign_State.md); [`v1.9.5_PRODUCTION_AUDIT.md`](../reports/v1.9.5_PRODUCTION_AUDIT.md); [`PROJECT_CONTEXT.md`](../archive/PROJECT_CONTEXT.md)

### TD-P2-009 — Broad type, console, and placeholder hygiene baseline

- **Category:** Maintainability / correctness signals
- **Priority:** P2
- **Status:** Open
- **Affected paths:** `services/`, `core/`, `components/`, `android/`, `tests/`
- **Impact:** Large warning and marker baselines make it difficult to distinguish intentional diagnostics from accidental synthetic or incomplete behavior.
- **Owner:** Unassigned
- **Exit criteria:** Establish category-specific budgets, replace unsafe `any` and production console calls where practical, and remove or explicitly gate placeholder/simulation markers in production paths.
- **Validation:** Repeatable scoped scans, lint warning trend, and targeted code review; no blanket suppression.
- **Target milestone:** M17 hygiene burn-down
- **Metrics baseline:** 62 console calls, 131 explicit `any` matches, and 66 placeholder/simulation/stub/mock/TODO markers from the release-baseline scan.
- **Evidence:** [`v1.9.5_CODE_GAP_MAPPING.md`](../reports/v1.9.5_CODE_GAP_MAPPING.md); [`GAP_MATRIX_2026.md`](../reports/GAP_MATRIX_2026.md)

### TD-P2-010 — Stale scripts and configuration references

- **Category:** Developer experience / configuration hygiene
- **Priority:** P2
- **Status:** In Progress — active commands/config updated; Capacitor sync remains blocked by the absent production `dist/` output and the tracked generated asset was intentionally not hand-edited.
- **Affected paths:** `playwright.config.ts`, `capacitor.config.json`, `android/app/src/main/assets/capacitor.config.json`, `docs/archive/`, `docs/operations/`, `.github/dependabot.yml`
- **Impact:** Active tooling and documentation can instruct contributors to use npm/npx or report obsolete version policy, increasing drift and non-reproducible local results.
- **Owner:** Unassigned
- **Exit criteria:** Active commands use pnpm; generated Capacitor configuration is synchronized; historical references are either labeled as historical or updated when they describe current policy.
- **Validation:** Active command scan and documentation review passed; `pnpm exec cap sync android` remains open because the required production `dist/index.html` is absent. The authoritative root config correction is retained, and the generated Android asset was reverted rather than claimed as synchronized.
- **Target milestone:** M16 release baseline for active paths; M17 for historical cleanup
- **Metrics baseline:** Playwright used `npm run dev`; Capacitor config declared `npmClient: npm`; archived docs contained `npm`/`npx` instructions.
- **Evidence:** [`CONTRIBUTING.md`](../../CONTRIBUTING.md); [`ANDROID_RELEASE_PREP.md`](ANDROID_RELEASE_PREP.md); `playwright.config.ts`

### TD-P1-011 — Dependency audit baseline

- **Category:** Dependency security / supply chain
- **Priority:** P1
- **Status:** In Progress — current main and PR #439's compatible overrides fixed three advisories; three residual findings are explicitly dispositioned, with two time-bound exception approvals pending and the `esbuild` finding marked not affected for production/release. Issue #399 is not resolved by this follow-up.
- **Affected paths:** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `scripts/ci/audit_with_exceptions.mjs`, `scripts/ci/dependency-audit-exceptions.json`, `tests/ci/dependency-audit-policy.test.mjs`, `tests/ci/fixtures/dependency-audit-report.json`, `.github/workflows/ci.yml`, `.github/workflows/android-release.yml`, and the CI security-audit step
- **Impact:** The reproducible dependency graph still contains one high and two low findings. The `bigint-buffer` and `elliptic` paths cannot currently move to published patched packages without breaking compatibility, while `esbuild` remains explicitly tracked as not affected for production/release. PR CI must expose pending decisions without inventing approval, while release promotion must remain blocked until security/COO approval is durable.
- **Owner:** Conxian security maintainers
- **Exit criteria:** `pnpm audit` reports no residual findings, or every remaining finding has a reviewed, time-bounded disposition with evidence; release mode passes only when every active exception has a real approval URL, approver identity, and approval date.
- **Validation:** The versioned ledger at `scripts/ci/dependency-audit-exceptions.json` strictly matches every current low-or-higher audit advisory by ID, package, severity, observed version, role classification, path count, reachability, and disposition. Default `pnpm exec node scripts/ci/audit_with_exceptions.mjs --evidence "$RUNNER_TEMP/conxius-dependency-audit.json"` passes with three findings and warnings for the two pending approvals. `--require-approved-exceptions` writes release evidence but fails specifically for `GHSA-3gc7-fjrx-p6mg` and `GHSA-848j-6mx2-7j84`, so promotion remains blocked. The reproducible security overrides remain in `pnpm-workspace.yaml` and the lockfile; `CI=true corepack pnpm install --frozen-lockfile` must remain lockfile-clean. The current-main audit evidence and PR #439 compatibility checks are recorded in [`DEPENDENCY_ADVISORY_DISPOSITIONS_2026-07.md`](DEPENDENCY_ADVISORY_DISPOSITIONS_2026-07.md).
- **Target milestone:** M16 release baseline
- **Metrics baseline:** Three fixed advisories are removed from the current ledger by compatible overrides: `GHSA-2g4f-4pwh-qvx6` (`ajv@8.12.0` → `8.18.0`), `GHSA-w5hq-g745-h8pq` (`uuid` versions `8.3.2`, `10.0.0`, and `11.1.0` → `11.1.1`), and `GHSA-4x5r-pxfx-6jf8` (`@babel/core@7.29.0` → `7.29.7`). Residual state is `bigint-buffer@1.1.5` high/exception/pending, `elliptic@6.6.1` low/exception/pending, and `esbuild@0.27.3` low/not-affected for production and release. All residual exceptions expire on **2026-08-19**; no approval is recorded.
- **Evidence:** `scripts/ci/audit_with_exceptions.mjs`; `scripts/ci/dependency-audit-exceptions.json`; `tests/ci/fixtures/dependency-audit-report.json`; `pnpm-workspace.yaml`; `.github/workflows/ci.yml`; `.github/workflows/android-release.yml`; [`DEPENDENCY_ADVISORY_DISPOSITIONS_2026-07.md`](DEPENDENCY_ADVISORY_DISPOSITIONS_2026-07.md); [`Sovereign_State.md`](../state/Sovereign_State.md); [`ANDROID_RELEASE_PREP.md`](ANDROID_RELEASE_PREP.md)

#### Current disposition ledger (reviewed 2026-07-22)

| Advisory | Package / observed version | Severity | Disposition | Evidence / decision state |
| --- | --- | --- | --- | --- |
| `GHSA-3gc7-fjrx-p6mg` | `bigint-buffer@1.1.5` | High | Time-bound `exception`, approval `pending`, expires **2026-08-19** | Production Wormhole/Solana paths; advisory says `>=1.1.6`, but npm has no `1.1.6+` release. `CON-1525` and GitHub `#399` are tracking context only, not approval evidence. |
| `GHSA-848j-6mx2-7j84` | `elliptic@6.6.1` | Low | Time-bound `exception`, approval `pending`, expires **2026-08-19** | Production Wormhole/CosmJS and Payjoin paths; advisory says `>=6.6.2`, but npm has no `6.6.2` release. `CON-1525` and GitHub `#399` are tracking context only, not approval evidence. |
| `GHSA-g7r4-m6w7-qqqr` | `esbuild@0.27.3` | Low | `not-affected` for production/release | The advisory is confined to the local Vite development-server response-read surface. Release uses `pnpm run build` and does not run/expose that dev server; `0.28.1` was tested and breaks `vite-plugin-top-level-await` production builds. |

The default PR gate explicitly warns on pending approval and may merge the
remediation work. The release gate invokes
`--require-approved-exceptions`; it blocks promotion while either exception is
pending. A future `approved` record must contain a real durable approval URL,
approver identity, and approval date. This implementation does **not** mark
CON-1525 complete and does **not** claim security or COO approval.

### TD-P0-012 — Deterministic Android onboarding wallet creation

- **Category:** Android onboarding / wallet-secret generation
- **Priority:** P0
- **Status:** In Progress — secure generation and fail-closed persistence slice implemented; Android SDK, device, and release validation remain open.
- **Affected paths:** `android/app/src/main/kotlin/com/conxius/wallet/viewmodel/OnboardingViewModel.kt`, `android/app/src/main/kotlin/com/conxius/wallet/viewmodel/WalletCreationService.kt`, `android/core-bitcoin/src/main/kotlin/com/conxius/wallet/bitcoin/SecureMnemonicGenerator.kt`
- **Impact:** The onboarding release path previously created every wallet from the same fixed BIP-39 test phrase, making independent wallet creation unsafe and invalidating recovery sovereignty.
- **Owner:** Unassigned
- **Exit criteria:** Onboarding uses cryptographically secure BIP-39 entropy through the existing BDK primitive; encryption completes before persistence; generation, encryption, and persistence failures leave onboarding incomplete without a partial seed record; focused regression tests cover validity, distinct entropy, ordering, and failure paths.
- **Validation:** The production path no longer contains the fixed phrase; focused generator and wallet-creation tests are added. `./gradlew --no-daemon :core-bitcoin:testDebugUnitTest --tests 'com.conxius.wallet.bitcoin.SecureMnemonicGeneratorTest'` and `./gradlew --no-daemon :app:testDebugUnitTest --tests 'com.conxius.wallet.viewmodel.WalletCreationServiceTest'` remain blocked in this devbox because no Android SDK or `ANDROID_HOME`/`ANDROID_SDK_ROOT` is available. Android task discovery passes with `./gradlew --no-daemon :app:tasks --all`.
- **Target milestone:** M16 release baseline security gate
- **Metrics baseline:** One deterministic 12-word test mnemonic was assigned directly in `OnboardingViewModel.createWallet()`; no release-path entropy or regression coverage existed.
- **Evidence:** `android/core-bitcoin/src/main/kotlin/com/conxius/wallet/bitcoin/SecureMnemonicGenerator.kt`; `android/app/src/main/kotlin/com/conxius/wallet/viewmodel/WalletCreationService.kt`; [issue #357](https://github.com/Conxian/conxius-wallet/issues/357)

## Burn-down policy

1. **Priority order:** P0 security and release gates before P1 reliability/coverage, then P2 hygiene.
2. **Evidence required:** Every status change must name the command, test, review, or artifact that satisfied the exit criteria. A passing synthetic test is not proof of a native production implementation.
3. **Fail closed:** Unsupported production/native operations remain rejected until their native implementation and negative-path tests are verified.
4. **No speculative compatibility:** Do not pin or downgrade Android or JavaScript dependencies solely to make a task pass. Capture the exact error and leave the debt open when the safe compatibility path is unknown.
5. **Metrics:** Regenerate the scoped baselines at each release-hardening checkpoint. Counts are directional until the scan command and scope are recorded.
6. **Ownership:** `Unassigned` is intentional until a maintainer accepts the item and records the owner in this file.
7. **Review gate:** P0/P1 changes require review before promotion to `main`, consistent with [`OPERATING_MODEL.md`](OPERATING_MODEL.md).

## Related evidence and gap reports

- [`GAP_MATRIX_2026.md`](../reports/GAP_MATRIX_2026.md)
- [`v1.9.5_CODE_GAP_MAPPING.md`](../reports/v1.9.5_CODE_GAP_MAPPING.md)
- [`CI_WORKFLOW_REMEDIATION_REPORT.md`](../reports/CI_WORKFLOW_REMEDIATION_REPORT.md)
- [`v1.9.5_PRODUCTION_AUDIT.md`](../reports/v1.9.5_PRODUCTION_AUDIT.md)
- [`ANDROID_SDK_REVIEW.md`](../reports/ANDROID_SDK_REVIEW.md)
- [`ANDROID_RELEASE_PREP.md`](ANDROID_RELEASE_PREP.md)
- [`GAPS_AND_RECOMMENDATIONS_ROUND_2.md`](../archive/GAPS_AND_RECOMMENDATIONS_ROUND_2.md)
- [`PROJECT_CONTEXT.md`](../archive/PROJECT_CONTEXT.md)
