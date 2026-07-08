---
title: Sovereign State
layout: page
permalink: /docs/state/sovereign
---

# Sovereign State (v1.9.5)

**Context:** Phase 5 Native Migration Complete. COO Alignment Complete (2026-06-30).
**Status:** ALIGNED — Full Production Operational State

## 🛡️ Security Architecture
- **CXN Guardian**: Local privacy filtering active for all AI/Network egress.
- **The Conclave**: StrongBox-backed hardware isolation for BIP-39 mnemonics.
- **Fail-Closed**: `ProductionRuntimeGuard.failClosed()` enforces release-build safety across all native managers.
- **Secret Scanning**: Gitleaks + GitGuardian integrated in CI. `.gitleaks.toml` with documented allowlists.
- **Dependency Security**: pnpm overrides force-resolve transitive vulnerabilities (29→6 vulns). `pnpm-workspace.yaml` managed.
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
- **Build**: pnpm v11.9.0, TypeScript 6.0.3, Vite 8.1.0, Vitest 4.1.9.

## 📜 Repository State (2026-06-30)
- **Branch**: `main` only. All 13 stale branches archived.
- **Issues**: 0 open.
- **Milestones**: 0 open.
- **PRs**: 0 open.
- **Last commit**: `c2dc78b fix(security): add pnpm overrides...`
- **Verification**: Build ✅ | TypeScript ✅ | ESLint (0 errors) ✅ | Tests (passing) ✅ | Audit (6 vulns) ✅
