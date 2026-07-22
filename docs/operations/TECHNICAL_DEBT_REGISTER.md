# Technical Debt Register — Release Baseline Hardening

**Authority:** Canonical technical-debt inventory for `Conxian/conxius-wallet`.
**Issue:** [#357](https://github.com/Conxian/conxius-wallet/issues/357)
**Baseline captured:** 2026-07-22 from `origin/main` at `ac5ee4651398162617d14b1c982ad977fbbffa57`
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
| TypeScript / typescript-eslint | TypeScript `7.0.2`; `typescript-eslint` `8.65.0` supports `>=4.8.4 <6.1.0` | Unsupported parser/runtime combination introduced by PR #425; TypeScript 7 remains separate migration work under issue #396. |
| Lint | `pnpm run lint`: exit `2` during `typescript-eslint` initialization because TypeScript 7 is unsupported | Lint could not provide a useful baseline until the supported TypeScript 6 bridge was restored. |
| JavaScript tests | 61 files; 245 passed, 1 skipped; about 52s | Existing tests pass, but this does not prove native or protocol production paths. |
| Android configuration | AGP `9.3.0`; configuration failed before task discovery because `org.jetbrains.kotlin.android` is rejected by AGP 9; Jetifier deprecation warning present | Android validation was blocked at configuration time. |
| CI artifacts | CI uploaded `test-results`, `playwright-report`, `blob-report`, and `coverage` with no producing job | Successful CI could attempt empty uploads. |
| Scheduled cleanup | One workflow checked out the repository and deleted runner-local directories | No durable cleanup value on ephemeral GitHub-hosted runners. |
| Static debt scan | 62 console calls, 131 explicit `any` matches, 66 placeholder/simulation/stub/mock/TODO markers across production paths | Broad hygiene debt remains; counts are directional and must be regenerated before burn-down claims. |
| Active npm command/config scan | One active command invocation plus Capacitor `npmClient: npm` | pnpm migration was incomplete in active tooling. |

## Issue #357 branch checkpoint

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
| Dependency audit | Passed with time-bounded exception | `corepack pnpm exec node scripts/ci/audit_with_exceptions.mjs` ran `pnpm audit --audit-level=high --json`: 6 findings total (3 low, 2 moderate, 1 high), with only `GHSA-3gc7-fjrx-p6mg` for `bigint-buffer@1.1.5` allowed through 2026-08-19; any other high/critical advisory fails CI. |

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
- **Status:** Open
- **Affected paths:** `android/core-bitcoin/src/main/kotlin/com/conxius/wallet/bitcoin/`, `services/ark.ts`, `services/bitvm.ts`, `services/rgb.ts`, `services/ntt.ts`, `services/lightning.ts`
- **Impact:** Several protocol paths are described as bridged or production-ready while reports identify stubs, simulations, placeholder cryptography, or incomplete native implementations. Synthetic success can mask unsupported production operations.
- **Owner:** Unassigned
- **Exit criteria:** Every production-capable protocol operation has a verified native implementation or an explicit fail-closed guard; tests distinguish simulation from production and cannot report synthetic success as production readiness.
- **Validation:** Protocol-by-protocol evidence review, native unit/instrumentation tests, and negative tests for unsupported production operations.
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

### TD-P1-005 — Deterministic JavaScript toolchain and lint compatibility

- **Category:** Toolchain / lint
- **Priority:** P1
- **Status:** In Progress — TypeScript 7 regression remediated on the restore branch; TypeScript 7 migration remains open under issue #396.
- **Affected paths:** `package.json`, `pnpm-lock.yaml`, `scripts/ci/check_typescript_compatibility.mjs`, `tests/ci/typescript-compatibility.test.mjs`, `.github/workflows/ci.yml`, `.github/workflows/android-release.yml`, `eslint.config.js`
- **Impact:** Local, CI, and release environments selected different pnpm versions, while PR #425 promoted TypeScript `7.0.2` outside `typescript-eslint` `8.65.0` support and crashed lint. The approved bridge is TypeScript `6.0.3`; TypeScript 7 requires the separate migration and validation tracked by issue #396.
- **Regression/remediation:** PR #425 introduced the TypeScript 7 regression on `main`; this change restores the exact TypeScript `6.0.3` bridge and adds a repository-owned guard that fails before lint, typecheck, or build when the approved contract drifts. No wallet or native runtime behavior is changed.
- **Owner:** Unassigned
- **Exit criteria:** `packageManager` declares pnpm `11.13.0`; CI/release/local verification select it through Corepack or the action; TypeScript is pinned to the exact approved bridge `6.0.3`; the compatibility guard fails clearly for a promoted unsupported major and points to issue #396; frozen install and lint pass without broad rule weakening.
- **Validation:** `CI=true pnpm install --frozen-lockfile` passed; `pnpm run check:typescript-compat` passed; focused compatibility tests passed 6/6; `pnpm run lint` passed with 0 errors and 630 warnings; `pnpm run typecheck` passed; `pnpm test --run` passed 73 files with 334 passed and 1 skipped; `pnpm run build` passed; `pnpm run test:e2e` passed 30/30. TypeScript 7 remains open migration work under issue #396.
- **Target milestone:** M16 release baseline
- **Metrics baseline:** Local `10.28.1`, CI `11.13.0`, release `10.30.3`; after PR #425, TypeScript `7.0.2` caused lint exit `2` while typecheck still passed.
- **Evidence:** [`CONTRIBUTING.md`](../../CONTRIBUTING.md); [`Sovereign_State.md`](../state/Sovereign_State.md); `scripts/ci/check_typescript_compatibility.mjs`; `eslint.config.js`; [issue #396](https://github.com/Conxian/conxius-wallet/issues/396)

### TD-P1-006 — E2E and Android CI coverage

- **Category:** Test coverage / release confidence
- **Priority:** P1
- **Status:** Open
- **Affected paths:** `.github/workflows/ci.yml`, `.github/workflows/android-release.yml`, `playwright.config.ts`, `e2e/`, `android/`
- **Impact:** CI runs Vitest and a web build but does not run Playwright E2E or the requested Android unit-test gates. Release confidence is therefore narrower than the documented checklist.
- **Owner:** Unassigned
- **Exit criteria:** CI has intentional, resource-bounded Playwright coverage and Android unit-test coverage; failure artifacts are produced by the jobs that upload them; release checks are separated from publishing.
- **Validation:** Successful CI runs with named E2E and Android test jobs, plus local reproductions. PR #390 adds focused Esplora/Kotlin unit coverage but no Compose test because the current environment lacks the Android SDK; this does not satisfy the Android/E2E gate.
- **Target milestone:** M16 release baseline / M17 coverage expansion
- **Metrics baseline:** Current CI has one JavaScript test command and one build command; no E2E or Android test job.
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
- **Status:** In Progress — one reviewed, time-bounded high-severity exception remains.
- **Affected paths:** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `scripts/ci/audit_with_exceptions.mjs`, `scripts/ci/dependency-audit-exceptions.json`, CI security-audit step
- **Impact:** The repository still reports one high and five lower-severity dependency vulnerabilities; release policy needs a documented remediation or accepted exception before promotion.
- **Owner:** Conxian security maintainers
- **Exit criteria:** `pnpm audit` reports no high/critical findings, or every remaining finding has a reviewed, time-bounded exception with an upstream/remediation plan.
- **Validation:** `corepack pnpm exec node scripts/ci/audit_with_exceptions.mjs` runs `pnpm audit --audit-level=high --json`, validates exception ownership/expiry, and fails on any high/critical advisory other than the exact active exception. The current exception is `GHSA-3gc7-fjrx-p6mg` for `bigint-buffer@1.1.5`, expires 2026-08-19, and has no published `bigint-buffer` `1.1.6+` release available to install. The reproducible security overrides remain in `pnpm-workspace.yaml` and the lockfile; `CI=true corepack pnpm install --frozen-lockfile` passed without lockfile changes.
- **Target milestone:** M16 release baseline
- **Metrics baseline:** 6 findings: 3 low, 2 moderate, 1 high; current gate passes only because the single high finding has the reviewed exception above. No critical findings are present.
- **Evidence:** `scripts/ci/audit_with_exceptions.mjs`; `scripts/ci/dependency-audit-exceptions.json`; `pnpm-workspace.yaml`; [`Sovereign_State.md`](../state/Sovereign_State.md)

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
