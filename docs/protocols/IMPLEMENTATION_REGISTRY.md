---
title: Implementation Registry
layout: page
permalink: /docs/implementation-registry
---

# Conxius Implementation Registry (v1.6.0)

## I. CORE PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Bitcoin L1** | ✅ PRODUCTION | Native BDK (BIP-84/86) integration. |
| **Lightning** | ✅ BRIDGED | Native Breez Manager + TS Breez SDK. |
| **Babylon Staking** | ✅ BRIDGED | Native Babylon Manager + TS payload constructors. |
| **NIP-47 (NWC)** | ✅ BRIDGED | Native NwcManager + TS event support. |
| **DLC (Discreet Log)** | ✅ BRIDGED | Native DlcManager + TS offer/settle flow. |
| **sBTC Bridge** | ✅ PRODUCTION | Clarity 4.0 contract in core/stacks-bridge.clar. |
| **Ark** | ✅ BRIDGED | Native ArkManager + TS Simulation. |
| **StateChain** | ✅ BRIDGED | Native StateChainManager + TS Simulation. |
| **Maven** | ✅ BRIDGED | Native MavenManager + TS AI Marketplace. |
| **Liquid** | ✅ BRIDGED | Native LiquidManager + TS Liquidjs support. |
| **EVM (BOB/RSK)** | ✅ BRIDGED | Native EvmManager + TS Ethers support. |
| **Musig2** | ✅ BRIDGED | Native Musig2Manager + TS session management. |
| **Stacks** | ✅ BRIDGED | Native StacksManager + Stacks.js (TS). |
| **RGB** | ✅ BRIDGED | Native RgbManager + WASM-based validation (TS). |
| **BitVM** | ✅ BRIDGED | Native BitVmManager + Optimistic logic (TS). |
| **Web5** | ✅ BRIDGED | Native Web5Manager + Web5 API (TS). |
| **Yield (Yield.xyz)** | ✅ BRIDGED | Native Yield Manager + TS yield discovery. |
| **Insurance (Parametric)**| ✅ BRIDGED | Native Insurance Manager + TS cover purchase. |
| **Interoperability** | ✅ BRIDGED | Native Interoperability Manager + 1inch/LI.FI (TS). |
| **B2B Gateway** | ✅ BRIDGED | Native B2bManager + CoinsPaid (TS). |

## III. ASSET PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Ordinals / Runes** | ✅ PRODUCTION | Native inscription and transfer support via BDK. |
| **RGB Assets** | 🚀 ENHANCED | Initial mint/transfer flow support (TS). |
| **Taproot Assets** | 🚀 ENHANCED | Initial discovery support (TS). |

## IV. NATIVE ARCHITECTURE (PHASE 4/5)

| Component | Status | Tech Stack |
| :--- | :--- | :--- |
| **UI Layer** | ✅ NATIVE | Jetpack Compose, Material 3 |
| **Secure Enclave** | ✅ NATIVE | StrongBox, TEE-backed Keystore |
| **Bitcoin Logic** | ✅ NATIVE | BDK Kotlin (v0.30.0) |
| **Database** | ✅ NATIVE | Room + SQLCipher (Encrypted) |
| **Integrity** | ✅ NATIVE | Play Integrity API + Root/Emulator Detection |

---

*Status Definitions:*
- **PRODUCTION:** Fully implemented in the native Android layer.
- **BRIDGED:** Core logic in native Kotlin, high-level UI/API in TS/React.
- **TS-ONLY:** Logic resides solely in the legacy/companion TS service layer.
- **ENHANCED:** Experimental/In-development features with partial implementation.
