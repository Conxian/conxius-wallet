---
title: Product Requirements Document
layout: page
permalink: /prd
---

# Conxius Wallet PRD (Production Grade)

## 1. Executive Summary

**Product:** Conxius Wallet, a **Multi-Chain Sovereign Interface**, an offline-first Android wallet that bridges the Bitcoin ecosystem (L1, Lightning, Stacks, Rootstock, Liquid, Nostr) with interlayer execution capabilities, including Wormhole-based Native Token Transfers (NTT).

**Mission:** Deliver hardware-level security on a mobile device, enabling sovereign management of Bitcoin L1 and L2 assets.

**Value Proposition:** *Hardware-level security without the dongle.*

**Institutional Expansion:** The ecosystem is enhanced by the **Conxian Gateway**, a B2B-focused web portal for corporate treasury, institutional token launches, and shielded enterprise payments.

**Monetization:** Capture fees on cross-chain NTT executions, gas abstraction services, and B2B SaaS subscriptions via the Gateway.

---

## 2. Business & Competitive Landscape

### 2.1. Business State: [ALL COMPLETED]

- **[MARKET_FIT]:** [COMPLETED]
- **[RISK_COMPLIANCE]:** [COMPLETED]
- **[TOKENOMICS]:** [COMPLETED]
- **[ROADMAP]:** [COMPLETED]

### 2.2. Industry Benchmarking (2024 Analysis)

| Competitor | Core Strength | Conxius Advantage |
| :--- | :--- | :--- |
| **Zeus / Phoenix** | Deep Lightning UX | Conxius anchors Lightning in a multi-chain Enclave. |
| **Ledger / Trezor** | Hardware Security | Conxius provides TEE security + Native L2 execution. |
| **Fireblocks / Copper**| B2B Custody | Conxian Gateway provides sovereign B2B tools without custody. |
| **MetaMask** | Web3 Ecosystem | Conxius applies Web3 agility to a Bitcoin-first root. |

---

## 3. Core Technical Specifications

### 3.1. Architecture

The primary differentiator is the **Native Enclave Core**: keys for all supported protocols are generated and used within a hardened boundary (Android Keystore + memory-only seed handling) and never leave the device's secure memory.

### 3.2. B2B Expansion via Conxian Gateway

The **Conxian Gateway** (Standalone Web App) serves as the B2B enhancement layer:
- **Corporate Profiles**: Managed via Conxius Wallet and signed by DID for Gateway auth.
- **Shielded B2B Assets**: Advanced privacy-focused treasury tools.
- **Institutional Launchpad**: Tooling for enterprise tokenization.
- **Unified Auth**: Secure session handshakes between mobile Conclave and Gateway web interface.

### 3.3. Complexity Analysis & Performance

To maintain sub-second performance on mobile hardware, all core scanning and derivation logic is optimized for linear time complexity.

**UTXO Scanning Complexity:**
The algorithm for identifying spendable outputs across multiple layers is bounded by:
$$ O(n) $$
Where $n$ is the number of UTXOs in the user's set.

**Performance Hardening (Persistence & Fusion):**
To target a >90% reduction in address derivation latency, the architecture employs a singleton **Persistent Crypto Worker**. Additionally, **ECC Engine Fusion** integrates `@noble/curves` for high-speed point arithmetic.

---

## 4. Functional Requirements

### 4.1. Key Management (Native Enclave Core)

- **FR-KEY-01**: Master Seed must be encrypted at rest using Android Keystore AES-GCM.
- **FR-KEY-02**: Recovery Phrase (Mnemonic) must be encrypted and stored in `mnemonicVault`.
- **FR-KEY-03**: Decrypted seed must reside in memory only during signing and be zeroed immediately after.
- **FR-KEY-04**: Biometric authentication required for high-value operations.

### 4.2. Transactions & B2B Integration

- **FR-TX-01**: Support BIP-84 (Native Segwit) and BIP-86 (Taproot) derivation.
- **FR-TX-02**: Support atomic swaps via **Changelly API v2** (proxied) and **THORChain** (native).
- **FR-TX-03 (B2B)**: Integration with **Conxian Gateway** for institutional-grade DeFi and shielded operations.

#### 4.2.1. Wormhole NTT (Native Token Transfers)

- **FR-NTT-01**: Full execution lifecycle: Source signing → VAA Retrieval → Destination redemption.
- **FR-NTT-02**: No NTT "VAA" can be broadcast without a local Conclave-generated proof.

---

## 5. Non-Functional Requirements

### 5.1. Security

- **NFR-SEC-01**: No sensitive data in logs (seed, private keys, macaroons).
- **NFR-SEC-02**: App preview in "Recents" must be obscured (FLAG_SECURE).
- **NFR-SEC-03**: Root detection warning on startup.

---

## 6. Sovereign Expansion Architecture (Matrix)

| Protocol | Conclave Integration Path | Status |
| :--- | :--- | :--- |
| **Conxian Gateway** | Web3 Integration (Next.js) | PRODUCTION |
| **Bitcoin L1** | Native Rust (BDK) | PRODUCTION |
| **Lightning** | JNI Bridge (Greenlight) | PRODUCTION |
| **Stacks (Clarity 4)** | Capacitor (Stacks.js) | PRODUCTION |
| **Liquid** | GDK Integration | PRODUCTION |
| **Rootstock** | Web3 / Ethers.js | PRODUCTION |
| **NTT Bridge** | Sovereign Transceiver | PRODUCTION |
| **Web5 (TBD)** | DIDs and DWN storage | PRODUCTION |

---

## 7. Production-Ready UX: The Sovereign Handshake

The final user experience for NTT and B2B transfers is designed to be a "Sovereign Handshake." A complex, multi-stage operation is reduced to a single user authorization, followed by a persistent status tracker.

---

## 8. Continuous Improvement & Verification

- **PRD Updates**: This document is the source of truth.
- **Testing**: Every PR must pass `testDebugUnitTest` for Android and `npm test` for logic.
- **Verification**: Release builds are verified on physical Pixel devices before publication.
