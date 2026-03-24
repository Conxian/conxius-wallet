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

### 2.1. Business State: [PRODUCTION] (Complexity: $O(1)$)

- **[MARKET_FIT]:** [ORCHESTRATING]
- **[RISK_COMPLIANCE]:** [ORCHESTRATING]
- **[TOKENOMICS]:** [ORCHESTRATING]
- **[ROADMAP]:** [ALIGNED - PHASE 5]

---

## 3. Core Technical Specifications

### 3.1. Bridged Sovereign Architecture (Complexity: $O(1)$)

Conxius utilizes a **Bridged Sovereign Architecture** to balance rapid protocol support with hardware-level security:
- **Native Enclave Core**: All private keys and seeds are managed by the Android Keystore + StrongBox. Signing occurs exclusively in the native layer via dedicated Kotlin managers.
- **TypeScript Protocol Layer**: High-level protocol logic (payload construction, API interaction) is handled in a secure TS environment.
- **Native Bridge Managers**: A full suite of 20+ Kotlin managers (e.g., `BdkManager`, `YieldManager`) bridge the TS layer to native Rust/Kotlin libraries for critical operations.

### 3.2. Native Migration (Phase 5: "Clean Break") (Complexity: $O(1)$)

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
| **Stacks** | BRIDGED | Stacks.js (TS) + Native Stacks Manager |
| **Liquid** | BRIDGED | Liquidjs (TS) + Native Liquid Manager |
| **Babylon** | BRIDGED | TS Payload + Native Babylon Manager |
| **DLCs** | BRIDGED | TS Offer Flow + Native DlcManager |
| **BOB / RSK** | BRIDGED | TS Ethers + Native EVM Manager |
| **RGB / BitVM** | BRIDGED | AluVM Simulation (TS) + Native Managers |
| **Ark / StateChain** | PRODUCTION | Native V-UTXO Logic + Stacks Bridge |
| **Web5** | BRIDGED | Web5 API (TS) + Native Web5 Manager |
| **Yield / Insurance** | BRIDGED | TS Protocol Entry + Native Managers |
| **Swap / B2B** | BRIDGED | TS Aggregator + Native Managers |

---

*Verified by OpenSpec Alignment Design.*

---

## 5. UI/UX STANDARDIZATION (Sovereign Earthy)

As of v1.6.0, all Conxian Protocol interfaces (Conxius Wallet, Gateway, Explorer) MUST adhere to the **Sovereign Earthy** visual identity.

### 5.1. Design Ethos
- **Foundational Palette**: 60% Ivory (#FDFBF7), 30% Pure White (#FFFFFF), 10% Earth/Brand Tones.
- **Institutional Clarity**: High-contrast dark typography against bright surfaces to ensure financial data legibility and reduce cognitive fatigue.
- **Atmospheric Cues**: Hero sections and primary brand headers may utilize full-bleed deep brand colors to establish presence.
- **Interaction Model**: Use structural spacing and micro-borders (1px) for depth, minimizing heavy drop shadows to maintain a crisp, professional aesthetic.
