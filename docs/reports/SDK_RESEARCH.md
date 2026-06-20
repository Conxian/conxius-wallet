---
title: SDK Research Report
layout: page
permalink: /docs/sdk-research
---

# SDK Research Report: Full Bitcoin Ecosystem Enhancements

**Date:** 2026-06-20
**Status:** EXPANDED
**Context:** Researching SDKs for BitVM2, Babylon, Ark, and Sovereign Node Enhancements.

## 1. BitVM Bridge (BitVM2)

- **SDK:** `/bitvm/bitvm` (Rust/Script).
- **Status:** **INTEGRATED (ALPHA)**.
- **Deep Dive (CON-1217)**: The Groth16 verification process (BN254 curve) is split into **364 independent taps** for on-chain execution to bypass Bitcoin's script limits.
  - **VALIDATING_TAPS (1)**: Handles core arithmetic verification of the SNARK proof.
  - **HASHING_TAPS (363)**: Verifies the hash chain of intermediate states.
  - **Disprove Logic**: Verifiers can challenge fraudulent operator claims via `disprove_core` which asserts `Hash_fn(input) == operator_claimed_input_hash` and triggers if `Hash_fn(output) != operator_claimed_output_hash`.
  - **Optimization**: Utilize `/api/generate-groth16-segments` to generate the 364 executable script segments from a raw proof.

## 2. Babylon Staking

- **SDK:** `/websites/garden_finance` (JS/API) & `BabylonManager.kt`.
- **Status:** **PRODUCTION**.
- **Implementation**: Native Taproot staking via `BabylonManager.kt`.
- **Action**: Align with `bitcoinlayers.org` risk metadata for Babylon's staking trust model.

## 3. Ark Protocol (V-UTXO)

- **SDK:** `/arkworks-rs/crypto-primitives` (Rust).
- **Status:** **RESEARCH**.
- **Implementation Details**: Leveraging Schnorr signatures and Blake2s-based Pseudo-Random Functions (PRF) for deterministic V-UTXO management.
- **Constraint**: Requires native V-UTXO management within the Enclave for high-performance mobile execution via `ArkManager.kt`.

## 4. FDC3 Interoperability (CON-1181)

- **Standard**: FDC3 v2.x for financial desktop interoperability.
- **Native Resolver**: Register `com.conxius.wallet.FDC3_INTENT` in AndroidManifest.
- **Key Method**: `fdc3.raiseIntentForContext(context, [targetApp])` for ergonomic intent resolution.
- **Context Type**: `fdc3.instrument` for mapping Bitcoin layer assets.
- **Bridge**: Implementation requires `Fdc3Plugin.kt` to bridge TypeScript `fdc3.raiseIntent` calls to Android Intent filters.

## 5. Sovereign AI Security (CONX-SEC)

- **Module**: `services/ai-security.ts`.
- **Sanitization**: Outgoing prompts are audited to strip PII and sensitive cryptographic identifiers (addresses, mnemonics, extended keys).
- **Normalization**: ZWC (Zero Width Character) normalization strips obfuscation to prevent bypasses.

## 6. Summary Table (v1.9.2 Alignment)

| Technology | Preferred SDK | Target Version | Status |
| :--- | :--- | :--- | :--- |
| **BitVM2** | `bitvm/bitvm` | 1.9 | ✅ |
| **Babylon** | `BabylonManager.kt` | 1.9 | ✅ |
| **Ark V-UTXO** | `ArkManager.kt` | 1.9 | 🚀 |
| **FDC3 Resolver**| `Fdc3Plugin.kt` | 1.9 | 🚀 |
| **AI Security** | `ai-security.ts` | 1.9 | ✅ |

---
*Updated: June 20, 2026*
