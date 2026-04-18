---
title: SDK Research Report
layout: page
permalink: /docs/sdk-research
---

# SDK Research Report: Full Bitcoin Ecosystem Enhancements

**Date:** 2026-04-18
**Status:** UPDATED (v1.6.0 Alignment)
**Context:** Researching SDKs for Taproot Musig2, RGB Client-Side Validation, and Device Integrity.

## 1. Taproot Musig2 (BIP-327)

- **SDK:** `@noble/curves` (JavaScript/TypeScript) and `rust-secp256k1` (Rust/Kotlin).
- **Status:** **INTEGRATED** via `@noble/curves` for Phase 4.
- **Verification:** Production-ready 2-of-3 threshold signature aggregation implemented using @noble/curves and native Musig2Manager.
- **Action:** Implement interactive Musig2 session management in `services/musig2.ts`.

## 2. RGB Client-Side Validation

- **SDK:** `rgb-lib-kotlin` (JNI).
- **Status:** **PROTOTYPED**.
- **Issue:** Memory constraints for full DAG validation on mobile.
- **Action:** Transition to `rgb-lib-kotlin` (JNI) for native Android performance.

## 3. Play Integrity API (Google)

- **SDK:** `com.google.android.play:integrity` (Native Android).
- **Status:** **INTEGRATED**.
- **Goal:** Replace legacy SafetyNet for attesting device health and integrity.
- **Action:** Verified in PlayIntegrityPlugin.kt and Integrated with App Startup logic.

## 4. WabiSabi (CoinJoin)

- **SDK:** `WabiSabi.js` (JavaScript).
- **Status:** **RESEARCH**.
- **Constraint:** Requires a persistent Tor connection.
- **Action:** Evaluate `Tor.js` vs. native Android Tor service for background coordination.

## 5. BitVM2 (Optimistic Fraud Proofs)

- **SDK:** `bitvm-js` (TS/Rust Bridge).
- **Status:** **RESEARCH**.
- **Context:** Researching optimistic verification of Groth16 proofs on Bitcoin.
- **Action:** Prototype the BitVM2 bridge logic for sBTC 2nd layer security.

## 6. Ark V-UTXOs

- **SDK:** `ark-sdk` (Kotlin/Rust).
- **Status:** **INTEGRATED (Shim)**.
- **Action:** Full transition from TS simulation to native ArkManager logic for OOR (Out-of-Round) payments.

## 7. Summary Table

| Technology | Preferred SDK | Target Version | Status |
| :--- | :--- | :--- | :--- |
| **Musig2** | `@noble/curves` | 1.6 | ✅ |
| **RGB** | `rgb-lib-kotlin` | 1.7 | 🚀 |
| **Play Integrity**| `Play Integrity` | 1.6 | ✅ |
| **CoinJoin** | `WabiSabi` | 1.7 | 🔍 |
| **BitVM2** | `bitvm-js` | 1.7 | 🔍 |
| **Ark** | `ark-sdk` | 1.6 | ✅ (Shim) |
