---
title: Sovereign State
layout: page
permalink: /docs/state/sovereign
---

# Sovereign State (v1.9.5)

**Context:** Phase 5 Native Migration Complete. COO Alignment Complete (2026-06-30).
**Status:** BASELINE HARDENING IN PROGRESS — see the [Technical Debt Register](../operations/TECHNICAL_DEBT_REGISTER.md) before treating release readiness as verified.

## Release-baseline authority

The [Technical Debt Register](../operations/TECHNICAL_DEBT_REGISTER.md) is the
canonical inventory for open and completed release-hardening work. Historical
audit documents are evidence records, not a substitute for current validation.

## Implementation state note (updated 2026-07-20)

PR #390 merged on July 20, 2026 at commit
`35ca6e0127006f6e82e1fac7b9c972a51a29fde7`. Its native BIP-352 slice includes bounded Esplora
transaction ingestion, native Rust/JNI scanning, Room cursor/match persistence, shallow reorg
fail-closed checks, and the public-only Compose path `DashboardScreen` → `WalletViewModel` →
`SilentPaymentScanCoordinator`. Live issue and pull-request counts are intentionally omitted here;
consult GitHub for current review state.

This note is not release validation. Android SDK-dependent compilation and unit tests, native
ABI packaging, Room migration execution, and device/emulator flows remain unverified in the current
environment. The issue-355 benchmark is host-only; compact-filter discovery, spending/tweak
recovery, native address encoding, authoritative spentness, labels/passphrases, raw/merkle proof
verification, and deeper reorg recovery remain outside this merged slice.

## 🛡️ Security Architecture
- **CXN Guardian**: Local privacy filtering active for all AI/Network egress.
- **The Conclave**: StrongBox-backed hardware isolation for BIP-39 mnemonics.
- **Fail-Closed**: `ProductionRuntimeGuard.failClosed()` enforces release-build safety across native managers; the TypeScript signer must also reject native enclave failures without software fallback.
- **Secret Scanning**: A checksum-verified, tokenless Gitleaks CLI plus optional
  GitGuardian are integrated in CI. `.gitleaks.toml` is narrow and
  `.gitleaksignore` is intentionally empty.
- **Dependency Security**: Security overrides are authoritative in `pnpm-workspace.yaml` and reproduced in `pnpm-lock.yaml`; pnpm `11.13.0` ignores the obsolete `package.json` `pnpm` field. The remaining high `bigint-buffer` advisory is controlled by the expiring exception in `scripts/ci/dependency-audit-exceptions.json` and the CI validator.
- **Security Journal**: `.jules/` hardening journal documents vulnerability patterns and prevention guides.

## ⛓️ Protocol Support
- **L1**: BDK Kotlin (Native)
- **Lightning**: Breez (Native/TS Bridged)
- **L2s**: sBTC (Clarity 4), Liquid, RBTC, BOB, B2, etc.
- **Asset Protocols**: Ordinals, Runes, RGB, Taproot Assets.
- **Bridge/Messaging**: Trust-tier policy enforcement via `services/trust-policy.ts` (T1-T4).
- **FDC3**: Native resolver with intent handlers (`services/fdc3.ts` → `Fdc3Plugin.kt`).

## 🏗️ Infrastructure
- **Gateway**: OData v4 synchronization for ERP/Institutional workflows.
- **Wasm**: Local-first verification layer for high-performance mobile execution.
- **CI/CD**: GitHub Actions with pinned SHAs, dependabot (npm daily, actions/gradle weekly).
- **Build policy**: pnpm `11.13.0` via the root `packageManager` declaration and Corepack. TypeScript 7.0.2 owns `tsc`/build validation through `@typescript/native`; the package named `typescript` is the TypeScript 6 API alias required by `typescript-eslint@8.65.0`. The guarded `tsc6` and `tsc` lanes are documented in [`TYPESCRIPT_DUAL_TOOLCHAIN.md`](../operations/TYPESCRIPT_DUAL_TOOLCHAIN.md); see the register for current validation evidence.

## TypeScript toolchain state

- **Compatibility API:** `typescript: npm:@typescript/typescript6@6.0.2` reports compiler version `6.0.3` and is consumed by ESLint/`typescript-eslint`.
- **Compiler/build validation:** `@typescript/native: npm:typescript@7.0.2` reports compiler version `7.0.2`; `pnpm run typecheck:ts7` and the default build path use this lane.
- **Guard:** `scripts/ci/check_typescript_toolchain.mjs` fails closed on alias, lockfile, script-ownership, or reported-version drift. TypeScript 7 promotion is not a routine Dependabot/direct-wildcard update and requires COO approval.
- **Open evidence:** editor selection, hosted Android/NDK/Rust/device validation, signed release validation, and any environment-specific Vite/plugin behavior remain separate gates.

## 📜 Historical Repository State (2026-06-30)
- **Branch**: `main` only. All 13 stale branches archived.
- **Issues**: 0 open.
- **Milestones**: 0 open.
- **PRs**: 0 open.
- **Last commit**: `c2dc78b fix(security): add pnpm overrides...`
- **Verification**: Do not rely on the historical all-green claim above; current lint, build, Android, E2E, artifact, and protocol evidence is tracked in the register.
