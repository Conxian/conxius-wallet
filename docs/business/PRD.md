---
title: Product Requirements Document
layout: page
permalink: /prd
---

# Conxius Wallet PRD (Full Bitcoin Ecosystem)

## 1. Executive Summary

**Product:** Conxius Wallet, the **Ultimate Sovereign Interface for the Full Bitcoin Ecosystem**. It is a pure native Android wallet that provides hardware-level security for every layer of the Bitcoin stack: L1 (BTC), Lightning, Liquid, Stacks, Rootstock (RSK), BOB (Build On Bitcoin), RGB, Ordinals, Runes, Ark, BitVM, State Chains, and Maven.

**Mission:** Empower users with sovereign control over the entire Bitcoin landscape through a unified, secure, and intuitive native interface.

**Value Proposition:** *The Citadel in your pocket.* Hardware-grade security (TEE/StrongBox) for the entire Bitcoin ecosystem without external hardware.

**Institutional Expansion:** The ecosystem is enhanced by the **Conxian Gateway** (hosted at `conxianlabs.com`), a B2B-focused web portal for corporate treasury, institutional token launches, and shielded enterprise payments, fully integrated with the native mobile enclave.

**Monetization:** Network utility fees (routing, swaps, bridge execution), gas abstraction services, and B2B SaaS subscriptions.

---

## 2. Business & Competitive Landscape

### 2.1. Business State: [PURE NATIVE TRANSITION]

- **[MARKET_FIT]:** [ORCHESTRATING]
- **[RISK_COMPLIANCE]:** [ORCHESTRATING]
- **[TOKENOMICS]:** [ORCHESTRATING]
- **[ROADMAP]:** [ALIGNED - PHASE 5 NATIVE]

*Current Priority: Completing the "Clean Break" native migration and protocol vertical implementation.*

### 2.2. Industry Benchmarking (2025-2026 Analysis)

| Competitor | Core Strength | Conxius Advantage |
| :--- | :--- | :--- |
| **Zeus / Phoenix** | Lightning UX | Conxius provides native Lightning + Full L2/Asset support + StrongBox. |
| **Ledger / Trezor** | Physical Security | Conxius provides Android TEE/StrongBox security + Native execution. |
| **Fireblocks** | B2B Custody | Conxian Gateway offers sovereign B2B tools without custody. |
| **Unisat / Xverse** | Ordinals/Runes | Conxius integrates these as native Bitcoin assets with enclave safety. |

---

## 3. Core Technical Specifications

### 3.1. Full Ecosystem Native Architecture

The architecture is built on a **Native Enclave Core** (Android Keystore + StrongBox) with a **Strictly Native UI** (Jetpack Compose).
- **BTC L1**: BIP-84 (Native Segwit), BIP-86 (Taproot)
- **Stacks**: m/44'/5757'/0'/0/0
- **Liquid**: m/84'/1776'/0'/0/0
- **EVM (BOB/RSK/ETH/B2/Botanix/Mezo/Phase 5 L2s)**: m/44'/60'/0'/0/0
- **RGB / Taproot Assets**: m/86'/0'/0'/0/0 (Taproot-centric)
- **Ark**: m/84'/0'/0'/1/0 (VTXO-specific)
- **State Chains**: m/84'/0'/0'/2/index
- **Maven**: m/84'/0'/0'/3/index
- **BitVM**: m/84'/0'/0'/4/0

### 3.2. Pure Native Implementation (SVN 1.5+)

- **Kotlin DSL Build System**: Aligned with Gradle 8.13 and AGP 8.2.2.
- **Modular Data Layer**: Room-based native persistence (replaces LocalStorage).
- **Reactive State Management**: StateFlow and ViewModels for unified logic.
- **Zero-Leak Memory**: Strict usage of ephemeral byte arrays and `try...finally` zero-filling.

---

## 4. Functional Requirements

### 4.1. Universal Asset Management

- **FR-ASSET-01**: Unified native dashboard for BTC, L2 assets, RGB, Ordinals, and Runes.
- **FR-ASSET-02**: Real-time balance fetching via native protocol clients (BDK/GDK/Breez).
- **FR-ASSET-03**: Support for BRC-20, Rune, and SIP-10 asset standards.
- **FR-ASSET-04**: **Full DAG Validation** for RGB assets via native `rgb-lib-wasm/jni`.

### 4.2. Secure Signing Enclave

- **FR-KEY-01**: TEE-backed key generation and storage (StrongBox priority).
- **FR-KEY-02**: PIN-gated access with biometric secondary auth.
- **FR-KEY-03**: WYSIWYS (What You See Is What You Sign) confirmation in native UI.
- **FR-KEY-04**: Support for batch signing (PSBTs) to reduce user fatigue.

### 4.3. Cross-Chain Interoperability

- **FR-INT-01**: Native 2nd-way pegs for Liquid and Stacks sBTC.
- **FR-INT-02**: Native-First Interoperability: Direct Bitcoin L1-to-L2 transfers.
- **FR-INT-03**: NTT Enhancements: Native Kotlin SDK for cross-chain token transfers.

---

## 5. Non-Functional Requirements

### 5.1. Security & Privacy

- **NFR-SEC-01**: Zero secret egress (keys never leave the enclave).
- **NFR-SEC-02**: Native Root/Jailbreak detection with multi-layer heuristics.
- **NFR-SEC-04**: **Mandatory Play Integrity Attestation** for high-value operations.
- **NFR-PRIV-01**: Native Tor implementation for privacy-sensitive layers.

---

## 6. Implementation Matrix (Full Ecosystem - Native Status)

| Protocol | Status | Native Enclave Support | UI Implementation |
| :--- | :--- | :--- | :--- |
| **Bitcoin L1** | PRODUCTION | ✅ BIP-84/86 (BDK) | ✅ Jetpack Compose |
| **Lightning** | PRODUCTION | ✅ Breez SDK | ✅ Jetpack Compose |
| **Stacks** | PRODUCTION | ✅ Clarity 4 | ✅ Jetpack Compose |
| **Liquid** | ENHANCED | ✅ Native Segwit (GDK) | ✅ Jetpack Compose |
| **RGB** | ENHANCED | ✅ Taproot Signer | ✅ Jetpack Compose |
| **Ark** | PRODUCTION | ✅ VTXO Path | ✅ Jetpack Compose |
| **BitVM** | PRODUCTION | ✅ Cryptographic Verifier | ✅ Jetpack Compose |
| **State Chains | PRODUCTION | ✅ Seq. Derivation | ✅ Jetpack Compose |

---

## 7. The Sovereign Handshake

Conxius reduces the complexity of the Bitcoin ecosystem into a single, unified "Sovereign Handshake" delivered through a high-performance native interface.

---

## 8. Continuous Verification

- **Automated CI**: GitHub Actions (Lint, Vitest, Gradle, Playwright).
- **Native Security**: Daily diagnostics via `DeviceIntegrityPlugin`.
- **Physical Audit**: Verified on real Pixel hardware for TEE/StrongBox compliance.
