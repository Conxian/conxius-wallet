---
title: SDK Research Report
layout: page
permalink: /docs/sdk-research
---

# SDK Research Report: Full Bitcoin Ecosystem Enhancements

**Date:** 2026-02-18
**Status:** DRAFT
**Context:** Researching SDKs for Taproot Musig2, RGB Client-Side Validation, and Device Integrity.

## 1. Taproot Musig2 (BIP-327)

- **SDK:** `@noble/curves` (JavaScript/TypeScript) and `rust-secp256k1` (Rust/Kotlin).
- **Status:** **INTEGRATED** via `@noble/curves` for Phase 4.
- **Verification:** Initial testing shows successful 2-of-3 threshold signature aggregation on-device.
- **Action:** Implement interactive Musig2 session management in `services/musig2.ts`.

## 2. RGB Client-Side Validation

- **SDK:** `rgb-lib-wasm` (JavaScript/WASM).
- **Status:** **PROTOTYPED**.
- **Issue:** Memory constraints for full DAG validation on mobile.
- **Action:** Transition to `rgb-lib-kotlin` (JNI) for native Android performance.

## 3. Play Integrity API (Google)

- **SDK:** `com.google.android.play:integrity` (Native Android).
- **Status:** **PLANNED**.
- **Goal:** Replace legacy SafetyNet for attesting device health and integrity.
- **Action:** Implement in `DeviceIntegrityPlugin.kt`.

## 4. WabiSabi (CoinJoin)

- **SDK:** `WabiSabi.js` (JavaScript).
- **Status:** **RESEARCH**.
- **Constraint:** Requires a persistent Tor connection.
- **Action:** Evaluate `Tor.js` vs. native Android Tor service for background coordination.

## 5. Summary Table

| Technology | Preferred SDK | Target Version | Status |
| :--- | :--- | :--- | :--- |
| **Musig2** | `@noble/curves` | 1.1 | ✅ |
| **RGB** | `rgb-lib-wasm` | 1.2 | 🚀 |
| **Play Integrity**| `Play Integrity` | 1.1 | 🚀 |
| **CoinJoin** | `WabiSabi` | 1.3 | 🔍 |
