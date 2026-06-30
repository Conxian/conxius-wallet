# PROJECT CONTEXT (June 2026)

**Current Status:** v1.9.2 Protocol Expansion
**Active Research:** BitVM2, Ark, FDC3, AI Security

## 1. Executive Summary
Conxius Wallet is a sovereign-first mobile wallet leveraging a Bridged Sovereign Architecture. We are currently expanding support for institutional interoperability (FDC3) and advanced Bitcoin Layer 2 protocols (BitVM2, Ark).

## 2. Technical Milestones (v1.9.2)
- **FDC3 Native Bridge**: Bridged TypeScript FDC3 calls to Native Android Intents (`services/fdc3.ts` -> `Fdc3Plugin.kt`).
- **BitVM2 Orchestration**: Implemented the 364-tap verification floor in `services/bitvm.ts` for Groth16 optimistic proof verification.
- **Ark V-UTXO Management**: Aligned `ArkManager.kt` with deterministic Blake2s PRF derivation logic.
- **AI Security**: Implemented outgoing prompt sanitization and ZWC normalization in `services/ai-security.ts`.

## 3. Active Gaps & Research
- **Native Rust Worker**: Transitioning BitVM2 segmentation and Blake2s PRF from mocks to high-performance Rust FFI.
- **RGB Light Client**: Researching pruned validation proofs for client-side validation on mobile devices.
- **Taproot Asset Light Client**: Porting verification logic to `BdkManager.kt`.

## 4. CI/CD & Governance
- **Hardening**: Pinned pnpm to `10.30.3`. Pinned GitHub Actions to stable SHAs.
- **Security**: Gitleaks and GitGuardian integrated for secret scanning.
- **Fail-Closed**: `ProductionRuntimeGuard.kt` enforces security for non-production paths.

---
*Updated: June 22, 2026*

## Session Notes (2026-06-30 — COO Alignment)
- **Full Maintenance Sync**: Pulled latest main, verified clean working tree.
- **Branch Audit**: Reviewed all 14 remote branches. 13 unmerged branches identified.
- **COO Triage Decision**: All 13 branches archived — work was superseded by direct-to-main merges (PRs #307–#351). Main has superior implementations (`ProductionRuntimeGuard.failClosed()` vs older `ensureDebugSimulationAllowed()`).
- **Artifact Preservation**: Extracted `.jules/cxn-arch-guardian.md`, `.jules/sentinel.md`, and `.vscode/extensions.json` from p0 branch.
- **Security Hardening**: Added pnpm overrides in `pnpm-workspace.yaml` for protobufjs, lodash, ws, undici, form-data. Reduced vulnerabilities from 29 (1 critical) to 6 (1 high, unresolvable bigint-buffer).
- **Documentation**: Updated AGENTS.md, CHANGELOG.md, PROJECT_CONTEXT.md with current operational state.
- **Full Verification**: Build (29s) ✅, TypeScript ✅, ESLint (0 errors) ✅, pnpm audit (6 vulns) ✅.
- **Operational State**: Repository declared at full production operational state. main is clean, synced, and verified.

## Session Notes (2026-06-22)
- **Gap Audit**: Completed full audit of protocol stubs across services/ and android/.
- **Research Expansion**: Updated GAP_MATRIX_2026.md with scores for Liquid, Silent Payments, and Babylon.
- **Remediation Mapping**: Created v1.9.2_CODE_GAP_MAPPING.md to link stubs to implementation tracks.
- **Linear Initialization**: Created CON-1281 (Silent Payments), CON-1282 (Ark PRF), and CON-1283 (GitGuardian Fix).
- **Environment Alignment**: Standardized pnpm environment and verified core protocol tests.
