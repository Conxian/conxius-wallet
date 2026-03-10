---
title: Implementation Registry
layout: page
permalink: /docs/implementation-registry
---

# Conxius Implementation Registry (v1.6.0)

## I. CORE PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Babylon Staking** | ✅ BRIDGED | Native Kotlin Manager + TS payload constructors. |
| **NIP-47 (NWC)** | ✅ BRIDGED | Native Kotlin Manager + TS event support. |
| **DLC (Discreet Log)** | ✅ BRIDGED | Native Kotlin Manager + TS offer/settle flow. |
| **sBTC Bridge** | ✅ PRODUCTION | Clarity 4.0 contract in core/stacks-bridge.clar. |
| **Ark** | ✅ BRIDGED | Native Ark Manager + TS Simulation. |
| **StateChain** | ✅ BRIDGED | Native StateChain Manager + TS Simulation. |
| **Maven** | ✅ BRIDGED | Native Maven Manager + TS Simulation. |
| **Yield (Yield.xyz)** | ✅ TS-ONLY | Multi-network yield discovery and entry. |
| **Insurance (Parametric)**| ✅ TS-ONLY | Neptune Mutual & InsurAce cover purchase. |

## II. INTEROPERABILITY

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **1inch / LI.FI** | ✅ TS-ONLY | Aggregated swaps and cross-chain bridging. |
| **CoinsPaid Gateway** | ✅ TS-ONLY | Merchant invoice generation for B2B. |

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

---

*Status Definitions:*
- **PRODUCTION:** Fully implemented in the native Android layer.
- **BRIDGED:** Core logic in native Kotlin, high-level UI/API in TS/React.
- **TS-ONLY:** Logic resides solely in the legacy/companion TS service layer.
- **ENHANCED:** Experimental/In-development features with partial implementation.
