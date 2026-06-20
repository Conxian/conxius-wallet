# Technical Specification: BitVM2 Multi-Tap Orchestrator (CON-1217)

**Version:** 1.0
**Status:** DRAFT
**Owner:** Sovereign Engineering

## 1. Overview
BitVM2 utilizes a 364-tap verification process for Groth16 SNARK proofs on Bitcoin. This specification defines how the mobile client orchestrates these taps to enable trust-minimized bridges.

## 2. Architecture Components

### 2.1 BitVmManager (Native Kotlin)
- **Role**: Entry point for the secure signing of tap commitments.
- **Methods**:
  - `generateSegments(rawProof: String): List<String>`: Native FFI call to Rust to segment proof.
  - `signChallenge(tapIndex: Int, commitment: String): String`: Signs a specific tap challenge.

### 2.2 BitVmWorker (Rust/Wasm)
- **Role**: Heavy-lifting arithmetic.
- **Crate**: `bitvm-rs` (custom fork for mobile).
- **Functionality**:
  - BN254 Pairing.
  - Groth16 Segmenting (364 chunks).
  - Hash chain verification.

### 2.3 BitVmService (TypeScript)
- **Role**: Coordination and UI state management.
- **Workflow**:
  1. Trigger Segment Generation.
  2. Monitor Optimistic Verification Period (OVP).
  3. Initiate Disprove logic if a challenge is detected.

## 3. The 364-Tap Workflow

### Phase 1: Segmentation
1. The client receives a `RawProof` from the bridge operator.
2. `BitVmManager` calls `bitvm_segment(proof)` which returns 1 `VALIDATING_TAP` and 363 `HASHING_TAPS`.
3. These segments are stored in the `EncryptedStorage`.

### Phase 2: Verification
1. The client parallelizes the verification of all 364 segments in the background.
2. Each segment is checked: `VerifySegment(chunk_i) == true`.

### Phase 3: Dispute (Disproving)
1. If any segment `i` fails, the client initiates a `Disprove` transaction.
2. The Enclave signs the dispute for `Tap[i]`.
3. The transaction is broadcast to Bitcoin L1 to slash the operator.

## 4. Security Considerations
- **Fail-Closed**: If a proof cannot be segmented, the bridge is assumed compromised.
- **TEE Signing**: Dispute transactions MUST be signed within the Secure Enclave.
