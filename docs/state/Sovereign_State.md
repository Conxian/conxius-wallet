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
- **Dependency Security**: Security overrides are authoritative in `pnpm-workspace.yaml` and reproduced in `pnpm-lock.yaml`; pnpm `11.13.0` ignores the obsolete `package.json` `pnpm` field. The versioned ledger in `scripts/ci/dependency-audit-exceptions.json` currently matches three low-or-higher findings: pending exceptions for high `bigint-buffer@1.1.5` and low `elliptic@6.6.1`, both expiring **2026-08-19**, plus a low `esbuild@0.27.3` `not-affected` disposition for production/release. `CON-1525` and GitHub `#399` are tracking context only; no approval is recorded.
- **Security Journal**: `.jules/` hardening journal documents vulnerability patterns and prevention guides.

## Dependency audit disposition state (reviewed 2026-07-22)

The prior compatible-override change fixed and removed these advisories from the
current audit ledger: `GHSA-2g4f-4pwh-qvx6` for `ajv@8.12.0` via `8.18.0`,
`GHSA-w5hq-g745-h8pq` for `uuid` versions `8.3.2`, `10.0.0`, and `11.1.0`
via `11.1.1`, and `GHSA-4x5r-pxfx-6jf8` for `@babel/core@7.29.0` via `7.29.7`.

The current `pnpm audit --audit-level=low --json` result has exactly three
findings. `GHSA-3gc7-fjrx-p6mg` (`bigint-buffer@1.1.5`, high) is a time-bound
exception for production Wormhole/Solana paths because npm has no published
`1.1.6+`; `GHSA-848j-6mx2-7j84` (`elliptic@6.6.1`, low) is a time-bound
exception for production Wormhole/CosmJS and Payjoin paths because npm has no
published `6.6.2`. Both exceptions expire on **2026-08-19** and have approval
status **pending**. `CON-1525` and GitHub `#399` are tracking references only,
not approval evidence; no approver or approval date is recorded.

`GHSA-g7r4-m6w7-qqqr` (`esbuild@0.27.3`, low) is explicitly tracked as
`not-affected` for production/release: the advisory is limited to the local Vite
development-server response-read surface, release artifacts use `pnpm run build`
and do not expose that server, and `esbuild@0.28.1` breaks
`vite-plugin-top-level-await` production builds. Default PR CI emits a pending
approval warning and may pass; the Android release workflow runs
`--require-approved-exceptions`, uploads evidence from `$RUNNER_TEMP`, and blocks
promotion until both exception records have real durable approval URL,
approver, and approval date. This state does not mark CON-1525 complete.

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
- **Build policy**: pnpm `11.13.0` via the root `packageManager` declaration and Corepack. The TypeScript dual-toolchain boundary keeps the TypeScript 7 CLI available as `tsc`, while `tsc6` and the imported `typescript` API remain on the TypeScript 6 line for the current `typescript-eslint` tooling. Issue #396 adds explicit dual validation; it is not approval for a TypeScript 7-only/default promotion. See [`TYPESCRIPT_DUAL_TOOLCHAIN.md`](../operations/TYPESCRIPT_DUAL_TOOLCHAIN.md) and the register for current validation evidence.

## 📜 Historical Repository State (2026-06-30)
- **Branch**: `main` only. All 13 stale branches archived.
- **Issues**: 0 open.
- **Milestones**: 0 open.
- **PRs**: 0 open.
- **Last commit**: `c2dc78b fix(security): add pnpm overrides...`
- **Verification**: Do not rely on the historical all-green claim above; current lint, build, Android, E2E, artifact, and protocol evidence is tracked in the register.
