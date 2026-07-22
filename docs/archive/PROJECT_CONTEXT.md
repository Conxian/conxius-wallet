# PROJECT CONTEXT (June 2026)

> **Historical context:** This archive is not the current release authority.
> Consult [`Sovereign_State.md`](../state/Sovereign_State.md), the
> [Technical Debt Register](../operations/TECHNICAL_DEBT_REGISTER.md), and the
> [Android Release Prep guide](../operations/ANDROID_RELEASE_PREP.md) for
> current validation state.

**Current Status:** v1.9.5 Protocol Expansion
**Active Research:** BitVM2, Ark, FDC3, AI Security

## 1. Executive Summary
Conxius Wallet is a sovereign-first mobile wallet leveraging a Bridged Sovereign Architecture. We are currently expanding support for institutional interoperability (FDC3) and advanced Bitcoin Layer 2 protocols (BitVM2, Ark).

## 2. Technical Milestones (v1.9.5)
- **FDC3 Native Bridge**: Bridged TypeScript FDC3 calls to Native Android Intents (`services/fdc3.ts` -> `Fdc3Plugin.kt`).
- **BitVM2 Orchestration**: Research/scaffolding only. The wallet validates a canonical envelope and returns typed fail-closed outcomes; no reviewed verifier or authoritative dispute path exists.
- **Ark V-UTXO Management**: Aligned `ArkManager.kt` with deterministic Blake2s PRF derivation logic.
- **AI Security**: Implemented outgoing prompt sanitization and ZWC normalization in `services/ai-security.ts`.

## 3. Active Gaps & Research
- **Native Rust Worker**: A reviewed BitVM2 verifier/segmenter remains unimplemented; any future Rust FFI must pass the canonical envelope and independent-review gates before enablement.
- **RGB Light Client**: Researching pruned validation proofs for client-side validation on mobile devices.
- **Taproot Asset Light Client**: Porting verification logic to `BdkManager.kt`.

## 4. CI/CD & Governance
- **Hardening (June snapshot)**: Pinned pnpm to `10.30.3`. Current repository policy is maintained separately; do not use this historical version as the active toolchain authority.
- **Security**: Gitleaks and GitGuardian integrated for secret scanning.
- **Fail-Closed**: `ProductionRuntimeGuard.kt` uses fail-closed release guards; debug simulation allowances and release enforcement must not be conflated.

---
*Updated: June 22, 2026*

## Session Notes (2026-07-22 — CON-1544 boundary)

- PR #441 merged the wallet-side KeyMint policy/evidence/canonical-binding
  boundary, and PR #442 merged Play Integrity SDK `1.6.0` opaque-token client
  acquisition.
- The [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md)
  records the implemented boundary, the legacy AES StrongBox/TEE fallback, the
  real-device/backend qualification matrix, and the P0 exit gate.
- PR #443 remains open and is not represented as delivered. Backend
  verification, real-device evidence, durable freshness/replay, centralized
  value-operation enforcement, rollout/runbook controls, and independent review
  remain pending.

## Session Notes (2026-06-30 — COO Alignment)
- **Full Maintenance Sync**: Pulled latest main, verified clean working tree.
- **Branch Audit**: Reviewed all 14 remote branches. 13 unmerged branches identified.
- **COO Triage Decision**: All 13 branches archived — work was superseded by direct-to-main merges (PRs #307–#351). Main has superior implementations (`ProductionRuntimeGuard.failClosed()` vs older `ensureDebugSimulationAllowed()`).
- **Artifact Preservation**: Extracted `.jules/cxn-arch-guardian.md`, `.jules/sentinel.md`, and `.vscode/extensions.json` from p0 branch.
- **Security Hardening**: Added pnpm overrides in `pnpm-workspace.yaml` for protobufjs, lodash, ws, undici, form-data. Reduced vulnerabilities from 29 (1 critical) to 6 (1 high, unresolvable bigint-buffer).
- **Documentation**: Updated AGENTS.md, CHANGELOG.md, PROJECT_CONTEXT.md with current operational state.
- **Full Verification**: Build (29s) ✅, TypeScript ✅, ESLint (0 errors) ✅, pnpm audit (6 vulns) ✅.
- **Operational State**: This historical full-production declaration is superseded for BitVM2. Current status is research/scaffolding with verification quarantined; consult the implementation registry and technical-debt register.

## Session Notes (2026-06-22)
- **Gap Audit**: Completed full audit of protocol stubs across services/ and android/.
- **Research Expansion**: Updated GAP_MATRIX_2026.md with scores for Liquid, Silent Payments, and Babylon.
- **Remediation Mapping**: Created v1.9.5_CODE_GAP_MAPPING.md to link stubs to implementation tracks.
- **Linear Initialization**: Created CON-1281 (Silent Payments), CON-1282 (Ark PRF), and CON-1283 (GitGuardian Fix).
- **Environment Alignment**: Standardized pnpm environment and verified core protocol tests.
