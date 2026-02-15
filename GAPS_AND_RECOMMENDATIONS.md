---
title: Gaps and Recommendations
layout: page
permalink: /gaps
---

# Gaps and Recommendations: Full Bitcoin Ecosystem

This document identifies technical and operational gaps in the Conxius ecosystem and provides actionable recommendations for alignment with the 'Full Bitcoin Ecosystem' vision.

---

## PROTOCOL INTEGRATION GAPS

### 1. **Ark Protocol - VTXO Management (P0)**

**Status:** 🟡 PARTIAL
**Gap:** Derivation path and client-side PSBT logic exist in `services/ark.ts`, but ASP communication loop is incomplete.
**Recommendation:** Complete the ASP interaction loop for VTXO forfeiture and redemption.

### 2. **RGB - Client-side Validation (P0)**

**Status:** 🏗️ SCAFFOLDED
**Gap:** `services/rgb.ts` implements consignment types and mock validation. The core RGB-lib validation and stash management are not integrated.
**Recommendation:** Integrate `rgb-lib` (WASM or Native Bridge) to handle client-side validation and consignment management in `services/rgb.ts`.

### 3. **BitVM - ZK-STARK Verifier (P1)**

**Status:** ✅ PARTIAL
**Gap:** `verifyBitVmProofFunctional` in `services/protocol.ts` implements structural checks but lacks full WASM-based STARK verification.
**Recommendation:** Further refine with a full WASM-based STARK verifier in Phase 4.

### 4. **BOB & Maven - Indexer Integration (P1)**

**Status:** ✅ PARTIAL
**Gap:** BOB uses eth_getBalance RPC; Maven fetchers in `services/maven.ts` need connection to a real indexer.
**Recommendation:** Configure real Maven protocol API endpoints in `services/network.ts` and refine `services/maven.ts`.

### 5. **State Chains - Sequential Signing (P1)**

**Status:** 🟡 PARTIAL
**Gap:** Recursive signing logic implemented in `services/statechain.ts`, but full transfer API integration is pending.
**Recommendation:** Verify endpoint compatibility with the State Chain coordinator API.

---

## SECURITY & ENCLAVE GAPS

### 6. **Web5 Enclave Bridge (P1)**

**Status:** ✅ PRODUCTION
**Gap:** Web5 KeyManager now delegates to a fully implemented `SecureEnclavePlugin`.
**Recommendation:** Optimize DID resolution latency.

### 7. **Taproot Schnorr Signing in Java (P0)**

**Status:** ✅ PRODUCTION
**Gap:** `SecureEnclavePlugin.java` now supports BIP-340 Schnorr signing with auxiliary randomness.
**Recommendation:** Perform a formal audit of the BouncyCastle-based Schnorr implementation.

### 8. **WYSIWYS for Advanced Layers (P1)**

**Status:** ✅ PRODUCTION
**Gap:** `parsePayload` expanded to support Bitcoin, Stacks, Ark, RGB, StateChain, Maven, BitVM, Liquid, and BOB.
**Recommendation:** Add more granular decoding for RGB contract operations.

---

## 📊 SUMMARY METRICS

| Category | P0 | P1 | P2 | Total |
| :--- | :--- | :--- | :--- | :--- |
| **Protocol Integration** | 2 | 2 | 0 | 4 |
| **Security & Enclave** | 0 | 0 | 0 | 0 |
| **UI/UX Alignment** | 0 | 1 | 2 | 3 |
| **TOTAL** | **2** | **3** | **2** | **7** |

---

## 🎯 RECOMMENDED EXECUTION ORDER (NEXT SPRINT)

1. **Ark VTXO Integration**: High priority for scaling payments.
2. **RGB-lib Integration**: Foundation for private smart contracts.
3. **Maven Indexer Connectivity**: Connect Maven to real-world data.

---

*Maintained by: Conxian Labs Architecture Team*
*Last Review: 2026-02-15*
