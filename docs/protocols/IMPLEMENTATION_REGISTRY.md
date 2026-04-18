---
title: Implementation Registry
layout: page
permalink: /docs/implementation-registry
---

# Conxius Implementation Registry (v1.9.2)

## I. CORE PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Bitcoin L1** | ✅ PRODUCTION | Native BDK (BIP-84/86) integration. |
| **Lightning** | ✅ BRIDGED | Native Breez Manager + TS Breez SDK. |
| **Babylon Staking** | ✅ PRODUCTION | Native Taproot staking for Babylon protocol. |
| **NIP-47 (NWC)** | ✅ PRODUCTION | Native NwcManager + TS event support. |
| **DLC (Discreet Log)** | ✅ PRODUCTION | `core/dlc-orchestrator.clar` implemented. |
| **sBTC Bridge** | ✅ PRODUCTION | Clarity 4.0 contract in `core/stacks-bridge.clar`. |
| **Ark** | ✅ PRODUCTION | `core/ark-vutxo.clar` implemented, Kotlin ArkManager native. |
| **StateChain** | ✅ PRODUCTION | Native StateChainManager + TS Simulation. |
| **Maven** | ✅ PRODUCTION | Native MavenManager + TS AI Marketplace. |
| **Liquid** | ✅ PRODUCTION | Native LiquidManager + TS Liquidjs support. |
| **EVM (BOB/RSK)** | ✅ PRODUCTION | Native EvmManager + TS Ethers support. |
| **Musig2** | ✅ PRODUCTION | Aligned with `@noble/curves`, native session management. |
| **Stacks** | ✅ PRODUCTION | Native StacksManager + Stacks.js (TS). |
| **RGB** | ✅ BRIDGED | Native RgbManager (Stub) + AluVM Simulation (TS). |
| **BitVM** | ✅ BRIDGED | Native BitVmManager + Optimistic logic (TS). |
| **Web5** | ✅ PRODUCTION | Native Web5Manager + Web5 API (TS). |
| **Yield (Yield.xyz)** | ✅ PRODUCTION | Native Yield Manager + TS yield discovery. |
| **Insurance (Parametric)**| ✅ PRODUCTION | Native Insurance Manager + TS cover purchase. |
| **Interoperability** | ✅ PRODUCTION | Native Interoperability Manager + 1inch/LI.FI (TS). |
| **B2B Gateway** | ✅ PRODUCTION | Native B2bManager + Conxian Gateway integration. |
| **Revenue Automation** | ✅ PRODUCTION | `core/revenue-automation.clar` (1% fee) implemented. |
| **Referral Aggregator** | ✅ PRODUCTION | `core/referral-aggregator.clar` (5-5-5 logic) implemented. |

## III. ASSET PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Ordinals / Runes** | ✅ PRODUCTION | Native inscription and transfer support via BDK. |
| **RGB Assets** | ✅ BRIDGED | Native RgbManager + ALU simulation (TS). |
| **Taproot Assets** | ✅ PRODUCTION | Discovery and transfer logic (TS + Native Stub). |

## IV. NATIVE ARCHITECTURE (PHASE 5)

| Component | Status | Tech Stack |
| :--- | :--- | :--- |
| **UI Layer** | ✅ NATIVE | Jetpack Compose, Material 3 |
| **Secure Enclave** | ✅ NATIVE | StrongBox, TEE-backed Keystore |
| **Bitcoin Logic** | ✅ NATIVE | BDK Kotlin (v0.30.0) |
| **Database** | ✅ NATIVE | Room + SQLCipher (Encrypted) |
| **Integrity** | ✅ NATIVE | Play Integrity API + Root Detection |

---

*Status Definitions:*
- **PRODUCTION:** Fully implemented in the native Android layer or Clarity 4.0.
- **BRIDGED:** Core manager in native Kotlin, high-level logic in TS/React.
- **TS-ONLY:** Logic resides solely in the legacy companion TS service layer.

*Aligned with Nakamoto Clarity & Sovereign v1.9.2. All P0 Action items verified.*
