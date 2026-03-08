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

### 3.1. Full Ecosystem Native Architecture

The architecture is built on a **Native Enclave Core** (Android Keystore + StrongBox). Unlike wallets that use a single derivation path, Conxius implements the full spectrum of derivation paths required for the Bitcoin ecosystem:
- **BTC L1**: BIP-84 (Native Segwit), BIP-86 (Taproot)
- **Stacks**: m/44'/5757'/0'/0/0
- **Liquid**: m/84'/1776'/0'/0/0
- **EVM (BOB/RSK/ETH/B2/Botanix/Mezo/Phase 5 L2s)**: m/44'/60'/0'/0/0
- **RGB / Taproot Assets**: m/86'/0'/0'/0/0 (Taproot-centric)
- **Ark**: m/84'/0'/0'/1/0 (VTXO-specific)
- **State Chains**: m/84'/0'/0'/2/index
- **Maven**: m/84'/0'/0'/3/index
- **BitVM**: m/84'/0'/0'/4/0

### 3.2. Native Migration (Phase 5: "Clean Break")

Conxius is now a **pure native Android architecture** (Kotlin/Rust):
- **Core Security**: StrongBox-backed AES-GCM encryption for BIP-39 seeds.
- **Protocol Core**: BDK (Bitcoin Dev Kit) for on-chain management and PSBT signing.
- **Persistence**: Room DB with KSP for reactive, encrypted data storage.
- **UI/UX**: Jetpack Compose for a high-performance, strictly native interface.

---

## 4. Functional Requirements (v1.6.0)

| Protocol | Status |
| :--- | :--- |
| **Bitcoin L1** | PRODUCTION (BIP-84/86) |
| **Lightning** | PRODUCTION (Breez/NWC) |
| **Stacks** | PRODUCTION (Clarity 4 / sBTC) |
| **Liquid** | PRODUCTION (Confidential Assets) |
| **Babylon** | PRODUCTION (BTC Staking) |
| **DLCs** | PRODUCTION (Discreet Log Contracts) |
| **BOB / RSK / B2** | PRODUCTION (EVM L2s) |
| **RGB / Taproot Assets** | ENHANCED (WASM Validation) |

---

*Verified by OpenSpec Alignment Design.*
