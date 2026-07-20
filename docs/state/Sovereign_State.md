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

## 📜 Repository State (2026-06-30)
- **Branch**: `main` only. All 13 stale branches archived.
- **Issues**: 0 open.
- **Milestones**: 0 open.
- **PRs**: 0 open.
- **Last commit**: `c2dc78b fix(security): add pnpm overrides...`
- **Verification**: Do not rely on the historical all-green claim above; current lint, build, Android, E2E, artifact, and protocol evidence is tracked in the register.
