---
title: Gaps and Recommendations
layout: page
permalink: /gaps
---

# Gaps and Recommendations: Full Bitcoin Ecosystem

This document identifies technical and operational gaps in the Conxius ecosystem and provides actionable recommendations for alignment with the 'Full Bitcoin Ecosystem' vision.

---

## 🏗️ PROTOCOL INTEGRATION GAPS

### 1. **Ark Protocol - VTXO Management (P0)**
**Status:** 🏗️ SCAFFOLDED
**Gap:** Derivation path exists (`m/84'/0'/0'/1/0`), but real VTXO tracking and ASP (Ark Service Provider) communication are missing.
**Recommendation:** Integrate an Ark SDK or implement the client-side VTXO state machine for shared UTXO management.

### 2. **RGB - Client-side Validation (P0)**
**Status:** 🏗️ SCAFFOLDED
**Gap:** UI for RGB exists, but the core RGB-lib validation and stash management are not integrated.
**Recommendation:** Integrate `rgb-lib` (WASM or Native Bridge) to handle client-side validation and consignment management.

### 3. **BitVM - ZK-STARK Verifier (P1)**
**Status:** 🏗️ SCAFFOLDED
**Gap:** `verifyBitVmProof` is a mock returning `true`.
**Recommendation:** Implement a real ZK-STARK verifier (e.g., using a library like `starknet-crypto` or custom WASM) to validate BitVM proofs on-device.

### 4. **BOB & Maven - Indexer Integration (P1)**
**Status:** 🏗️ SCAFFOLDED
**Gap:** Asset fetchers use mock data.
**Recommendation:** Configure real RPC/Indexer endpoints (e.g., BOB's EVM RPC and Maven's protocol API) in `services/protocol.ts`.

### 5. **State Chains - Sequential Signing (P1)**
**Status:** 🏗️ SCAFFOLDED
**Gap:** Signing logic for sequential State Chain keys is not finalized.
**Recommendation:** Implement the recursive signing pattern required for State Chain UTXO transfers in `services/signer.ts`.

---

## 🛡️ SECURITY & ENCLAVE GAPS

### 6. **Web5 Enclave Bridge (P1)**
**Status:** 🔧 PARTIAL
**Gap:** Web5 uses a default in-memory KeyManager instead of the SecureEnclavePlugin.
**Recommendation:** Create a custom `KeyManager` implementation for `@tbd54566975/web5` that delegates to `SecureEnclavePlugin`.

### 7. **Taproot Schnorr Signing in Java (P0)**
**Status:** 🔧 PARTIAL
**Gap:** `SecureEnclavePlugin.java` currently uses ECDSA. Taproot (RGB/Ordinals) requires Schnorr.
**Recommendation:** Update the native plugin to support Schnorr signing using BouncyCastle or a JNI bridge to `libsecp256k1`.

### 8. **WYSIWYS for Advanced Layers (P1)**
**Status:** 🔧 PARTIAL
**Gap:** The native confirmation dialog (`parsePayload`) lacks specific templates for RGB, Ark, and State Chain operations.
**Recommendation:** Expand `parsePayload` in `SecureEnclavePlugin.java` to decode and display details for all ecosystem-specific transaction types.

---

## 📊 SUMMARY METRICS

| Category | P0 | P1 | P2 | Total |
| :--- | :--- | :--- | :--- | :--- |
| **Protocol Integration** | 2 | 3 | 0 | 5 |
| **Security & Enclave** | 2 | 2 | 0 | 4 |
| **UI/UX Alignment** | 0 | 1 | 2 | 3 |
| **TOTAL** | **4** | **6** | **2** | **12** |

---

## 🎯 RECOMMENDED EXECUTION ORDER (NEXT SPRINT)

1. **Schnorr Support in Enclave**: Critical for RGB and Taproot-based assets.
2. **Ark VTXO Integration**: High priority for scaling payments.
3. **RGB-lib Integration**: Foundation for private smart contracts.
4. **Indexer Connectivity**: Connect BOB and Maven to real-world data.

---

*Maintained by: Conxian Labs Architecture Team*
*Last Review: 2026-02-15*
