# Gap & Research Matrix (2026)

**Date:** 2026-06-21
**Status:** DRAFT
**Scope:** BitVM2, Ark Protocol, FDC3 v2.x

## 1. Candidate Scoring

| Candidate | Maturity | Mobile-Friendly | Security | Total Score | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **BitVM2 (Alpha)** | 3/5 | 2/5 | 5/5 | **10/15** | Heavy orchestration (364 taps). Needs native Rust worker. |
| **Ark (V-UTXO)** | 4/5 | 4/5 | 5/5 | **13/15** | Well-defined PRF (Blake2s). High enclave compatibility. |
| **FDC3 (Standard)** | 5/5 | 3/5 | 4/5 | **12/15** | Mature standard. Android Intent mapping is the main gap. |

## 2. Identified Gaps

### G1: BitVM2 Tap Orchestration
- **Gap**: High computational and network cost to manage 364 transactions on a mobile device.
- **Remediation**: Use a "Sovereign Worker" (Rust/Wasm) to pre-calculate and verify segments before signing in the Enclave.

### G2: Ark V-UTXO Determinism
- **Gap**: Ensuring V-UTXO indexes are deterministic across device restores without heavy server-side state.
- **Remediation**: Implement the `Blake2s` PRF using the device's `RootSeed` + `V-UTXO Path` in the Enclave.

### G3: FDC3 Native Bridge
- **Gap**: Lack of a standardized Android Intent filter for FDC3 context types (e.g., `fdc3.instrument`).
- **Remediation**: Define a custom `com.conxius.wallet.FDC3_RESOLVER` intent filter and bridge it via `Fdc3Plugin.kt`.

## 3. Best Candidate Selection & Initialization

**Primary Candidate: Ark V-UTXO Management**
- *Initialization*: Implementing `ArkManager.kt` with native PRF support for deterministic V-UTXO deriving.
- *Status*: Moving to Implementation.

**Secondary Candidate: FDC3 Native Resolver**
- *Initialization*: Creating `Fdc3Plugin.kt` and updating `AndroidManifest.xml`.
- *Status*: Moving to Implementation.

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
