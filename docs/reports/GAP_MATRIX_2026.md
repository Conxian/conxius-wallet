# Gap & Research Matrix (2026)

**Date:** 2026-06-22
**Status:** UPDATED
**Scope:** BitVM2, Ark, FDC3, RGB, Liquid, Babylon, Silent Payments

## 1. Candidate Scoring

| Candidate | Maturity | Mobile-Friendly | Security | Total Score | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Ark (V-UTXO)** | 5/5 | 5/5 | 5/5 | **15/15** | PRF (Blake2s) in Kotlin via BouncyCastle. Native deterministic derivation verified. |
| **Liquid (Sidechain)** | 4/5 | 5/5 | 5/5 | **14/15** | Elements-based. Native signing/blinding fail-closed guards & confidential address validation. |
| **FDC3 (Standard)** | 5/5 | 4/5 | 4/5 | **13/15** | Mature standard. Android Intent mapping & TS bridge implemented. |
| **Silent Payments** | 4/5 | 4/5 | 5/5 | **13/15** | BIP-352 implemented in TS. Native Rust/JNI scanning merged (PR #390). |
| **BitVM2 (Research)** | 3/5 | 3/5 | 5/5 | **11/15** | Canonical envelope and typed quarantine boundary only. No reviewed verifier or native BN254 worker. |
| **RGB Protocol** | 3/5 | 3/5 | 5/5 | **11/15** | ALU simulation in TS. Native manager is a stub. |
| **Babylon Staking** | 3/5 | 3/5 | 5/5 | **11/15** | Native Taproot staking implemented. Finality provider gaps. |

## 2. Identified Gaps (Updated)

### G1: BitVM2 Native Verification
- **Gap**: BitVM2 verification, segment generation, challenge discovery, and dispute signing are unavailable in the wallet.
- **Status**: **RESEARCH / QUARANTINED**.
- **Remediation**: Integrate a pinned, independently reviewed native verifier and policy-approved transaction signer only after the canonical envelope and negative-vector gates pass.

### G2: Ark V-UTXO PRF Alignment
- **Gap**: `ArkManager.kt` used SHA-256 as a placeholder for Blake2s evaluation.
- **Status**: **RESOLVED / IMPLEMENTED**.
- **Remediation**: Integrated `org.bouncycastle:bcprov-jdk18on` with native `Blake2sDigest` evaluation for deterministic V-UTXO PRF derivation matching arkworks specs.

### G3: RGB / Taproot Asset Light Validation
- **Gap**: Client-Side Validation (CSV) is simulated in TS; native managers are stubs.
- **Status**: **STUBBED**.
- **Remediation**: Implement `rgb-lib-wasm` bridge or native Rust worker for DAG validation.

### G4: Liquid Confidentiality & Native Bridge
- **Gap**: Blinding and signing in `LiquidManager.kt` required production fail-closed guard enforcement and confidential validation.
- **Status**: **IN PROGRESS / HARDENED**.
- **Remediation**: Ported elements-lib confidential address validation to `services/liquid.ts` and enforced `ProductionRuntimeGuard` in `LiquidManager.kt`.

### G5: Silent Payment Scanning Performance
- **Gap**: BIP-352 scanning performance optimization on mobile.
- **Status**: **IN PROGRESS**.
- **Remediation**: PR #390 introduced bounded Rust/JNI scanning; compact-filter and tweak recovery validation ongoing.

### G6: CI/CD Secret Scanning Failure
- **Gap**: `secret-scan.yml` secondary scan fails when `GITGUARDIAN_API_KEY` is absent.
- **Status**: **FAIL-SAFE / CONTAINED**.
- **Remediation**: Configured `continue-on-error: true` so third-party credential absence does not block development CI, while Gitleaks enforces mandatory primary scanning.

### G7: Cross-Repo Synergy
- **Gap**: `conxius-platform` CI checks are failing (CON-1230/31/32).
- **Status**: **FAILING**.
- **Remediation**: Triage baseline failures in the platform repository.

---
*Aligned with v1.9.5 Research Findings, Production Audit, BouncyCastle Blake2s PRF integration, and Liquid Confidentiality hardening.*
