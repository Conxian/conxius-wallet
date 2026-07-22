---
title: Implementation Registry
layout: page
permalink: /docs/implementation-registry
---

# Conxius Implementation Registry (v1.9.5)

## I. CORE PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Bitcoin L1** | ✅ PRODUCTION | Native BDK (BIP-84/86) integration. |
| **BIP-110 client-side fee alignment** | 🟡 IN PROGRESS | `services/bitcoin-fee-oracle.ts` samples bounded confirmed blocks, excludes narrowly detected inscription envelopes, and falls back to the existing fee endpoint. This is client-side policy, not consensus compliance; see [BIP-110 alignment](../operations/BIP110_COMPLIANCE.md). |
| **BIP-352 Silent Payments** | 🟡 IN PROGRESS | Merged PR #390 implements bounded Rust/JNI scanning, Kotlin Esplora ingestion with cursor/persistence and shallow reorg fail-closed checks, plus a public-only Compose scan card. Pending release validation, mobile evidence, compact-filter discovery, spending/tweak recovery, native address encoding, authoritative spentness, and raw/merkle proof coverage. |
| **Lightning** | ✅ PRODUCTION | Native Breez Manager + TS Breez SDK. |
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
| **RGB** | ✅ PRODUCTION | Native RgbManager (Stub) + AluVM Simulation (TS). |
| **BitVM2** | 🔬 RESEARCH / QUARANTINED | Typed proof-envelope validation only. No reviewed wallet verifier, segment backend, challenge source, or authoritative dispute signer exists. |
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
| **RGB Assets** | ✅ PRODUCTION | Native RgbManager + ALU simulation (TS). |
| **Taproot Assets** | ✅ PRODUCTION | Discovery and transfer logic (TS + Native Stub). |

## IV. NATIVE ARCHITECTURE (PHASE 5)

| Component | Status | Tech Stack |
| :--- | :--- | :--- |
| **UI Layer** | ✅ NATIVE | Jetpack Compose, Material 3 |
| **Secure Enclave** | ✅ NATIVE | StrongBox, TEE-backed Keystore |
| **Bitcoin Logic** | ✅ NATIVE | BDK Kotlin (v0.30.0) |
| **Database** | ✅ NATIVE | Room + SQLCipher (Encrypted) |
| **Integrity** | ✅ NATIVE | Play Integrity API + Root Detection |

## BitVM2 Enablement Gate

BitVM2 is research/scaffolding and is quarantined from authoritative wallet
operations. Every current production entrypoint returns a typed `unsupported`,
`malformed`, or other non-authoritative outcome; none can return `verified`.

Before a reviewed verifier may be enabled, the canonical envelope must bind all
of the following fields without ambiguity: `schemaVersion`, `proof`,
`verificationKeyId`, `verificationKeyDigest`, ordered `publicInputs`, `curve`,
`circuitId`, `encoding`, `network`, `blockContext`, `tapCount`, `tapIndex`,
`domainSeparation`, `transactionBinding`, and `stateBinding`. Promotion also
requires a reviewed native verifier, reproducible negative and positive vectors,
independent cryptographic review, and a native policy-approved signer for the
exact bound dispute transaction.

No reviewed BitVM2 verifier exists in the wallet today. Simulated or structural
results are never authoritative and cannot authorize signing.

---

*Status Definitions:*
- **PRODUCTION:** Fully implemented in the native Android layer or Clarity 4.0.
- **IN PROGRESS:** A bounded implementation exists, but required scope or release evidence remains incomplete; it must not be represented as production-ready.
- **BRIDGED:** Core manager in native Kotlin, high-level logic in TS/React.
- **TS-ONLY:** Logic resides solely in the legacy companion TS service layer.

*Aligned with the current release-baseline evidence. Historical completion
claims do not override the BitVM2 quarantine or the Technical Debt Register.*
