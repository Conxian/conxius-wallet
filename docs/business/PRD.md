---
title: Product Requirements Document
layout: page
permalink: /prd
---

# Conxius Wallet PRD (Full Bitcoin Ecosystem)

## 1. Executive Summary

**Product:** Conxius Wallet, the **Ultimate Sovereign Interface for the Full Bitcoin Ecosystem**. It is an offline-first Android wallet that provides native, hardware-level security for every layer of the Bitcoin stack: L1 (BTC), Lightning, Liquid, Stacks, Rootstock (RSK), BOB (Build On Bitcoin), RGB, Ordinals, Runes, Ark, BitVM, State Chains, and Maven.

**Mission:** Empower users with sovereign control over the entire Bitcoin landscape through a unified, secure, and intuitive mobile interface.

**Value Proposition:** *The Citadel in your pocket.* Hardware-grade security (TEE/StrongBox) for the entire Bitcoin ecosystem without external hardware.

**Institutional Expansion:** The ecosystem is enhanced by the **Conxian Gateway** (hosted at `conxianlabs.com`), a B2B-focused web portal for corporate treasury, institutional token launches, and shielded enterprise payments, fully integrated with the mobile enclave.

**Monetization:** Network utility fees (routing, swaps, bridge execution), gas abstraction services, and B2B SaaS subscriptions.

---

## 2. Business & Competitive Landscape

### 2.1. Business State: [INFRASTRUCTURE PIVOT]

- **[MARKET_FIT]:** [ORCHESTRATING]
- **[RISK_COMPLIANCE]:** [ORCHESTRATING]
- **[TOKENOMICS]:** [ORCHESTRATING]
- **[ROADMAP]:** [ALIGNED - PHASE 4]

*Current Priority: Deploying the "Real Rails" (Changelly Proxy, Bisq Node, Wormhole Transceivers) to unblock production financial flows.*

### 2.2. Industry Benchmarking (2025-2026 Analysis)

| Competitor | Core Strength | Conxius Advantage |
| :--- | :--- | :--- |
| **Zeus / Phoenix** | Lightning UX | Conxius provides native Lightning + Full L2/Asset support. |
| **Ledger / Trezor** | Physical Security | Conxius provides Android TEE/StrongBox security + Native execution. |
| **Fireblocks** | B2B Custody | Conxian Gateway offers sovereign B2B tools without custody. |
| **Unisat / Xverse** | Ordinals/Runes | Conxius integrates these as native Bitcoin assets with enclave safety. |

---

## 3. Core Technical Specifications

### 3.1. Full Ecosystem Native Architecture

The architecture is built on a **Native Enclave Core** (Android Keystore + StrongBox). Unlike wallets that use a single derivation path, Conxius implements the full spectrum of derivation paths required for the Bitcoin ecosystem:
- **BTC L1**: BIP-84 (Native Segwit), BIP-86 (Taproot)
- **Stacks**: m/44'/5757'/0'/0/0
- **Liquid**: m/84'/1776'/0'/0/0
- **EVM (BOB/RSK/ETH)**: m/44'/60'/0'/0/0
- **RGB**: m/86'/0'/0'/0/0 (Taproot-centric)
- **Ark**: m/84'/0'/0'/1/0 (VTXO-specific)
- **State Chains**: m/84'/0'/0'/2/0

### 3.2. B2B Expansion via Conxian Gateway

The **Conxian Gateway** is the institutional portal:
- **Corporate Profiles**: Multi-sig treasury management via Conxius.
- **Shielded Payments**: Privacy-preserving B2B transactions.
- **Institutional Launchpad**: Compliant tokenization on Bitcoin L2s.

### 3.3. Performance & Security Hardening

- **Persistent Crypto Worker**: Eliminates worker spawning overhead; retains session secrets securely in memory.
- **ECC Engine Fusion**: Hybrid approach using `@noble/curves` and `tiny-secp256k1` for optimized arithmetic and Taproot operations.
- **Zero-Leak Memory**: Strict usage of `Uint8Array.fill(0)` and `try...finally` blocks for all sensitive material.

---

## 4. Functional Requirements

### 4.1. Universal Asset Management

- **FR-ASSET-01**: Unified dashboard for BTC, L2 assets, RGB, Ordinals, and Runes.
- **FR-ASSET-02**: Real-time balance fetching across all supported layers via redundant indexers.
- **FR-ASSET-03**: Support for BRC-20, Rune, and SIP-10 asset standards.
- **FR-ASSET-04**: **Full DAG Validation** for RGB assets via integrated `rgb-lib-wasm`.

### 4.2. Secure Signing Enclave

- **FR-KEY-01**: TEE-backed key generation and storage (StrongBox priority).
- **FR-KEY-02**: PIN-gated access with biometric secondary auth.
- **FR-KEY-03**: WYSIWYS (What You See Is What You Sign) confirmation for all layers.
- **FR-KEY-04**: Support for batch signing (PSBTs) to reduce user fatigue.
- **FR-KEY-05**: **Taproot Musig2** support for aggregated institutional multi-sig quorums.

### 4.3. Cross-Chain Interoperability

- **FR-INT-01**: Native 2nd-way pegs for Liquid and Stacks sBTC ((1)$ efficiency).
- **FR-INT-02**: Native-First Interoperability: Direct Bitcoin L1-to-L2 transfers for sovereign ecosystems; NTT reserved for non-Bitcoin satellites.
- **FR-INT-03**: NTT Enhancements: Support for Stacks principal hashing and sBTC manager flow.
- **FR-INT-04**: Atomic swaps via Boltz (Direct BTC-to-LN/Liquid) and Changelly (proxied).
- **FR-INT-05**: **Outcome-Based UI** for bridging, abstracting technical complexity from the user.

---

## 5. Non-Functional Requirements

### 5.1. Security & Privacy

- **NFR-SEC-01**: Zero secret egress (keys never leave the enclave).
- **NFR-SEC-02**: Native Root/Jailbreak detection with multi-layer heuristics.
- **NFR-SEC-03**: Strict protocol-level sanitization for the internal Web3 browser.
- **NFR-SEC-04**: **Mandatory Play Integrity Attestation** for high-value operations (>0.1 BTC).
- **NFR-PRIV-01**: Tor-enabled network calls for privacy-sensitive layers.
- **NFR-PRIV-02**: Integrated **WabiSabi CoinJoin** coordinator for native L1 privacy.

---

## 6. Implementation Matrix (Full Ecosystem)

| Protocol | Integration Status | Native Enclave Support |
| :--- | :--- | :--- |
| **Bitcoin L1** | PRODUCTION | ✅ BIP-84/86 |
| **Lightning** | PRODUCTION | ✅ Breez SDK |
| **Stacks** | PRODUCTION | ✅ Clarity 4 |
| **Liquid** | PRODUCTION | ✅ Native Segwit |
| **Rootstock** | PRODUCTION | ✅ EVM Compatible |
| **BOB (EVM L2)** | PRODUCTION | ✅ EVM Compatible |
| **RGB** | ENHANCED | ✅ Taproot Signer (WASM Ready) |
| **Ordinals/Runes** | PRODUCTION | ✅ Native Support |
| **Ark | PRODUCTION | ✅ VTXO Path |
| **BitVM** | PRODUCTION | ✅ Cryptographic STARK Verifier |
| **State Chains | PRODUCTION | ✅ Seq. Derivation |
| **Maven | PRODUCTION | ✅ Protocol Fetcher |
| **B2 Network** | PRODUCTION | ✅ EVM Path |
| **Botanix** | PRODUCTION | ✅ Spiderchain |
| **Mezo** | PRODUCTION | ✅ tBTC Bridge |

---

## 7. The Sovereign Handshake

Conxius reduces the complexity of the Bitcoin ecosystem into a single, unified "Sovereign Handshake." Whether signing an L1 transaction, a Lightning invoice, or a cross-chain NTT bridge, the user experience remains consistent, secure, and fast.

---

## 8. Continuous Verification

- **Automated CI**: GitHub Actions (Lint, TSC, Vitest, Playwright, Audit).
- **Native Security**: Daily diagnostics via `DeviceIntegrityPlugin`.
- **Physical Audit**: Verified on real Pixel hardware for TEE/StrongBox compliance.
- **E2E Readiness**: Comprehensive Playwright suite for cross-chain "Rails" validation.
