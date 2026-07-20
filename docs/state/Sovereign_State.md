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

## Current repository snapshot (2026-07-20)

GitHub reports **3 open issues** (`#381`, `#357`, and `#356`) and **2 open pull requests**
(`#392` and `#391`). PR #390 merged on July 20, 2026 at commit
`35ca6e0127006f6e82e1fac7b9c972a51a29fde7`. Its native BIP-352 slice includes bounded Esplora
transaction ingestion, native Rust/JNI scanning, Room cursor/match persistence, shallow reorg
fail-closed checks, and the public-only Compose path `DashboardScreen` → `WalletViewModel` →
`SilentPaymentScanCoordinator`.

This snapshot is not release validation. Android SDK-dependent compilation and unit tests, native
ABI packaging, Room migration execution, and device/emulator flows remain unverified in the current
environment. The issue-355 benchmark is host-only; compact-filter discovery, spending/tweak
recovery, native address encoding, authoritative spentness, labels/passphrases, raw/merkle proof
verification, and deeper reorg recovery remain outside this merged slice.

## 🛡️ Security Architecture
- **CXN Guardian**: Local privacy filtering active for all AI/Network egress.
- **The Conclave**: StrongBox-backed hardware isolation for BIP-39 mnemonics.
- **Fail-Closed**: `ProductionRuntimeGuard.failClosed()` enforces release-build safety across native managers; the TypeScript signer must also reject native enclave failures without software fallback.
- **Secret Scanning**: Gitleaks + GitGuardian integrated in CI. `.gitleaks.toml` with documented allowlists.
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
- **Build policy**: pnpm `11.13.0` via the root `packageManager` declaration and Corepack; TypeScript must remain on the supported `typescript-eslint` line. See the register for current validation evidence.

## 📜 Historical Repository State (2026-06-30)
- **Branch**: `main` only. All 13 stale branches archived.
- **Issues**: 0 open.
- **Milestones**: 0 open.
- **PRs**: 0 open.
- **Last commit**: `c2dc78b fix(security): add pnpm overrides...`
- **Verification**: Do not rely on the historical all-green claim above; current lint, build, Android, E2E, artifact, and protocol evidence is tracked in the register.
