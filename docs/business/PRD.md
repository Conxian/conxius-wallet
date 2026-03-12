---
title: Product Requirements Document
layout: page
permalink: /prd
---

# Conxius Wallet PRD (Full Bitcoin Ecosystem) - v1.6.0

## 1. Executive Summary

**Product:** Conxius Wallet, the **Ultimate Multi-Chain Sovereign Interface for the Full Bitcoin Ecosystem**. It is an offline-first Android wallet that provides native, hardware-level security for every layer of the Bitcoin stack: L1 (BTC), Lightning, Liquid, Stacks, Rootstock (RSK), BOB (Build On Bitcoin), RGB, Ordinals, Runes, Ark, BitVM, State Chains, and Maven.

**Mission:** Empower users with sovereign control over the entire Bitcoin landscape through a unified, secure, and intuitive mobile interface.

**Value Proposition:** *The Citadel in your pocket.* Hardware-grade security (TEE/StrongBox) for the entire Bitcoin ecosystem without external hardware.

**Institutional Expansion:** The ecosystem is enhanced by the **Conxian Gateway** (hosted at `conxianlabs.com`), a B2B-focused web portal for corporate treasury, institutional token launches, and shielded enterprise payments, fully integrated with the mobile enclave.

**Monetization:** Network utility fees (routing, swaps, bridge execution), gas abstraction services, and B2B SaaS subscriptions.

---

## 2. Business & Competitive Landscape

### 2.1. Business State: [PRODUCTION]

- **[MARKET_FIT]:** [ORCHESTRATING]
- **[RISK_COMPLIANCE]:** [ORCHESTRATING]
- **[TOKENOMICS]:** [ORCHESTRATING]
- **[ROADMAP]:** [ALIGNED - PHASE 5]

---

## 3. Core Technical Specifications

### 3.1. Bridged Sovereign Architecture

Conxius utilizes a **Bridged Sovereign Architecture** to balance rapid protocol support with hardware-level security:
- **Native Enclave Core**: All private keys and seeds are managed by the Android Keystore + StrongBox. Signing occurs exclusively in the native layer.
- **TypeScript Protocol Layer**: High-level protocol logic (payload construction, API interaction) is handled in a secure TS environment.
- **Native Bridge Managers**: Dedicated Kotlin managers bridge the TS layer to native Rust/Kotlin libraries for critical operations.

### 3.2. Native Migration (Phase 5: "Clean Break")

The project is transitioning to a **pure native Android architecture** (Kotlin/Rust):
- **Core Security**: StrongBox-backed AES-GCM encryption for BIP-39 seeds. [PRODUCTION]
- **Protocol Core**: BDK (Bitcoin Dev Kit) for on-chain management. [PRODUCTION]
- **Persistence**: Room DB with KSP for reactive, encrypted data storage. [PRODUCTION]
- **UI/UX**: Jetpack Compose for a high-performance interface. [PRODUCTION]

---

## 4. Functional Requirements (v1.6.0 Alignment)

| Protocol | Status | Implementation Details |
| :--- | :--- | :--- |
| **Bitcoin L1** | PRODUCTION | Native BDK (BIP-84/86) |
| **Lightning** | BRIDGED | Breez SDK (TS) + Native Breez Manager |
| **Stacks** | BRIDGED | Stacks.js (TS) + sBTC Bridge (Clarity) |
| **Liquid** | BRIDGED | Liquidjs (TS) + Native Liquid Manager |
| **Babylon** | BRIDGED | TS Payload + Native Staking Manager |
| **DLCs** | BRIDGED | TS Offer Flow + Native DLC Manager |
| **BOB / RSK / B2** | BRIDGED | TS Ethers + Native EVM Manager |
| **RGB / Taproot Assets** | ENHANCED | WASM Validation (TS) |
| **Ark / StateChain** | BRIDGED | Native Manager Stubs + TS Simulation |
| **Maven** | BRIDGED | Native Maven Manager + TS AI Marketplace |

---

*Verified by OpenSpec Alignment Design.*
