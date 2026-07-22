# Gap & Research Matrix (2026)

**Date:** 2026-06-22
**Status:** UPDATED
**Scope:** BitVM2, Ark, FDC3, RGB, Liquid, Babylon, Silent Payments

## 1. Candidate Scoring

| Candidate | Maturity | Mobile-Friendly | Security | Total Score | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Ark (V-UTXO)** | 4/5 | 4/5 | 5/5 | **13/15** | PRF (Blake2s) logic in Kotlin. High enclave compatibility. |
| **FDC3 (Standard)** | 5/5 | 4/5 | 4/5 | **13/15** | Mature standard. Android Intent mapping & TS bridge implemented. |
| **Liquid (Sidechain)** | 4/5 | 5/5 | 4/5 | **13/15** | Elements-based. Native signing/blinding stubs need FFI. |
| **Silent Payments** | 4/5 | 4/5 | 5/5 | **13/15** | BIP-352 implemented in TS. Native scanning is a stub. |
| **BitVM2 (Research)** | 3/5 | 3/5 | 5/5 | **11/15** | Canonical envelope and typed quarantine boundary only. No reviewed verifier or native BN254 worker. |
| **RGB Protocol** | 3/5 | 3/5 | 5/5 | **11/15** | ALU simulation in TS. Native manager is a stub. |
| **Babylon Staking** | 3/5 | 3/5 | 5/5 | **11/15** | Native Taproot staking implemented. Finality provider gaps. |

## 2. Identified Gaps (Updated)

### G1: BitVM2 Native Verification
- **Gap**: BitVM2 verification, segment generation, challenge discovery, and dispute signing are unavailable in the wallet.
- **Status**: **RESEARCH / QUARANTINED**.
- **Remediation**: Integrate a pinned, independently reviewed native verifier and policy-approved transaction signer only after the canonical envelope and negative-vector gates pass.

### G2: Ark V-UTXO PRF Alignment
- **Gap**: `ArkManager.kt` uses SHA-256 as a placeholder for Blake2s evaluation.
- **Status**: **PARTIAL**.
- **Remediation**: Swap SHA-256 for a proper Blake2s implementation (e.g., from BouncyCastle or Rust FFI) to match arkworks specs.

### G3: RGB / Taproot Asset Light Validation
- **Gap**: Client-Side Validation (CSV) is simulated in TS; native managers are stubs.
- **Status**: **STUBBED**.
- **Remediation**: Implement `rgb-lib-wasm` bridge or native Rust worker for DAG validation.

### G4: Liquid Confidentiality
- **Gap**: Blinding and signing in `LiquidManager.kt` are fail-closed stubs.
- **Status**: **STUBBED**.
- **Remediation**: Port elements-lib signing logic to native Kotlin or Rust FFI.

### G5: Silent Payment Scanning Performance
- **Gap**: BIP-352 scanning is compute-heavy; currently stubbed in native.
- **Status**: **STUBBED**.
- **Remediation**: Implement optimized elliptic curve point additions in native code to handle block scanning.

### G6: CI/CD Secret Scanning Failure
- **Gap**: `secret-scan.yml` fails due to missing `GITGUARDIAN_API_KEY`.
- **Status**: **FAILING**.
- **Remediation**: Add the API key to repository secrets.

### G7: Cross-Repo Synergy
- **Gap**: `conxius-platform` CI checks are failing (CON-1230/31/32).
- **Status**: **FAILING**.
- **Remediation**: Triage baseline failures in the platform repository.

## 3. Implementation Status & Best Candidate

**Best Candidate: Silent Payments (BIP-352)**
- **Rationale**: High score (13/15), strong user privacy demand, and TS logic is already mature. Native scanning would provide an immediate performance boost for the mobile app.
- **Next Step**: Implement native SP scanning in `SilentPaymentManager.kt`.

**Alternative: Ark V-UTXO PRF Refinement**
- **Rationale**: Critical for deterministic sovereign recovery.
- **Next Step**: Replace SHA-256 with Blake2s in `ArkManager.kt`.

---
*Aligned with v1.9.5 Research Findings and Production Audit.*
