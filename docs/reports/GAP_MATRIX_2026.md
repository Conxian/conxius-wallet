# Gap & Research Matrix (2026)

**Date:** 2026-06-22
**Status:** UPDATED
**Scope:** BitVM2, Ark Protocol, FDC3 v2.x

## 1. Candidate Scoring

| Candidate | Maturity | Mobile-Friendly | Security | Total Score | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **BitVM2 (Alpha)** | 3/5 | 3/5 | 5/5 | **11/15** | Orchestration (364 taps) implemented in TS. Needs native Rust worker. |
| **Ark (V-UTXO)** | 4/5 | 4/5 | 5/5 | **13/15** | Well-defined PRF (Blake2s). High enclave compatibility. |
| **FDC3 (Standard)** | 5/5 | 4/5 | 4/5 | **13/15** | Mature standard. Android Intent mapping & TS bridge implemented. |

## 2. Identified Gaps

### G1: BitVM2 Tap Orchestration
- **Gap**: High computational and network cost to manage 364 transactions on a mobile device.
- **Remediation**: Implemented 364-tap segmentation in `services/bitvm.ts`. Use a "Sovereign Worker" (Rust/Wasm) to pre-calculate and verify segments before signing in the Enclave.

### G2: Ark V-UTXO Determinism
- **Gap**: Ensuring V-UTXO indexes are deterministic across device restores without heavy server-side state.
- **Remediation**: Aligned `ArkManager.kt` with `Blake2s` PRF logic (`PRF(Seed, Input)`) as per arkworks research.

### G3: FDC3 Native Bridge
- **Gap**: Lack of a standardized Android Intent filter for FDC3 context types (e.g., `fdc3.instrument`).
- **Remediation**: Defined `com.conxius.wallet.FDC3_RESOLVER` intent filter in `AndroidManifest.xml` and bridged via `services/fdc3.ts` to `Fdc3Plugin.kt`.

## 3. Implementation Status (June 2026)

**Primary Candidate: Ark V-UTXO Management**
- *Initialization*: `ArkManager.kt` updated with PRF structure.
- *Status*: **IMPLEMENTED (Mocked PRF)**.

**Secondary Candidate: FDC3 Native Resolver**
- *Initialization*: `Fdc3Plugin.kt`, `AndroidManifest.xml`, and `services/fdc3.ts` integrated.
- *Status*: **IMPLEMENTED**.

**Orchestration: BitVM2 Verification Floor**
- *Initialization*: `services/bitvm.ts` updated with 364-tap orchestration.
- *Status*: **IMPLEMENTED**.

## 4. Extended Protocol Research (RGB & Taproot Assets)

| Protocol | Preferred SDK | Gaps | Score |
| :--- | :--- | :--- | :---: |
| **RGB Protocol** | `rgb-tools/rgb-lib` | Large client-side data storage for validation. | 11/15 |
| **Taproot Assets** | `lightninglabs/tapd` | Heavy daemon (tapd) dependency; needs mobile-native light client. | 12/15 |

### G4: RGB Client-Side Validation (CSV)
- **Gap**: Validating RGB contracts requires historical DAG data which can be gigabytes.
- **Remediation**: Implement a "Consensus-Checked" light validation model where a trusted BitVM2 verifier (or Sovereign Node) provides pruned validation proofs.

### G5: Taproot Asset Light Client
- **Gap**: No official mobile-native light client for Taproot Assets that doesn't require a full `tapd` instance.
- **Remediation**: Port core Taproot Asset commitment verification logic to the `BdkManager.kt` via Rust FFI.
