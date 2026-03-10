---
title: Implementation Registry
layout: page
permalink: /docs/implementation-registry
---

# Conxius Implementation Registry (v1.6.0)

## I. CORE PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Babylon Staking** | ✅ PRODUCTION | Native Kotlin stub & TS payload constructors. |
| **NIP-47 (NWC)** | ✅ PRODUCTION | Native Kotlin stub & TS event support. |
| **DLC (Discreet Log)** | ✅ PRODUCTION | Native Kotlin stub & TS offer/settle flow. |
| **sBTC Bridge** | ✅ PRODUCTION | Clarity 4.0 contract in core/stacks-bridge.clar. |
| **Yield (Yield.xyz)** | ✅ PRODUCTION | Multi-network yield discovery and entry. |
| **Insurance (Parametric)**| ✅ PRODUCTION | Neptune Mutual & InsurAce cover purchase. |

## II. INTEROPERABILITY

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **1inch / LI.FI** | ✅ PRODUCTION | Aggregated swaps and cross-chain bridging. |
| **CoinsPaid Gateway** | ✅ PRODUCTION | Merchant invoice generation for B2B. |

## III. ASSET PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Ordinals / Runes** | ✅ PRODUCTION | Native inscription and transfer support via BDK. |
| **RGB** | 🚀 ENHANCED | WASM-based validation integrated. |
| **Taproot Assets** | 🚀 ENHANCED | Initial mint/transfer flow support. |

## IV. NATIVE ARCHITECTURE (PHASE 4)

| Component | Status | Tech Stack |
| :--- | :--- | :--- |
| **UI Layer** | ✅ NATIVE | Jetpack Compose, Material 3 |
| **Secure Enclave** | ✅ NATIVE | StrongBox, TEE-backed Keystore |
| **Bitcoin Logic** | ✅ NATIVE | BDK Kotlin (v0.30.0) |
| **Database** | ✅ NATIVE | Room + SQLCipher (Encrypted) |
| **Integrity** | ✅ NATIVE | Root/Emulator Detection |
