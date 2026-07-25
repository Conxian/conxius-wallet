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
| **Lightning** | 🟠 VALUE OPERATIONS QUARANTINED | Native Breez, Breez plugin, and LND settlement entrypoints require an App-queue-issued exact-intent one-time capability. The wallet-owned authoritative evidence adapter remains intentionally unwired, and legacy Breez backend settlement paths are quarantined; production settlement qualification is not claimed. |
| **Babylon Staking** | ✅ PRODUCTION | Native Taproot staking for Babylon protocol. |
| **NIP-47 (NWC)** | ✅ PRODUCTION | Native NwcManager + TS event support. |
| **DLC (Discreet Log)** | ✅ PRODUCTION | `core/dlc-orchestrator.clar` implemented. |
| **sBTC Bridge** | ✅ PRODUCTION | Clarity 4.0 contract in `core/stacks-bridge.clar`. |
| **Ark** | 🟠 VALUE OPERATIONS QUARANTINED | Construction/discovery may remain available, but forfeit/redemption require the centralized native-only value gate and an authoritative ASP receipt. No synthetic transaction ID fallback remains. |
| **StateChain** | 🟠 VALUE OPERATIONS QUARANTINED | Transfer/withdraw require the centralized native-only value gate and an authoritative coordinator receipt. Missing evidence or receipt fails closed. |
| **Maven** | 🟠 VALUE OPERATIONS QUARANTINED | Discovery remains available; transfer requires the centralized native-only value gate and an authoritative sequencer receipt. |
| **Liquid** | ✅ PRODUCTION | Native LiquidManager + TS Liquidjs support. |
| **EVM (BOB/RSK)** | ✅ PRODUCTION | Native EvmManager + TS Ethers support. |
| **Musig2** | ✅ PRODUCTION | Aligned with `@noble/curves`, native session management. |
| **Stacks** | ✅ PRODUCTION | Native StacksManager + Stacks.js (TS). |
| **RGB** | 🟠 VALUE OPERATIONS QUARANTINED | Validation/draft logic is non-authoritative. Transfer signing and settlement require the centralized gate plus authoritative anchor/transport receipts; `pending_on_chain_txid` was removed. |
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
| **RGB Assets** | 🟠 VALUE OPERATIONS QUARANTINED | Discovery/validation only; transfer success is unavailable without authoritative evidence, anchor, and settlement receipts. |
| **Taproot Assets** | 🟠 VALUE OPERATIONS QUARANTINED | Discovery remains available. Transfer cannot sign without authoritative evidence and remains unsupported until a real tapd receipt adapter exists. |

## IV. NATIVE ARCHITECTURE (PHASE 5)

| Component | Status | Tech Stack |
| :--- | :--- | :--- |
| **UI Layer** | ✅ NATIVE | Jetpack Compose, Material 3 |
| **Secure Enclave** | ✅ NATIVE | Android Keystore with StrongBox requested where supported; existing AES storage may fall back to TEE. Universal StrongBox backing and protocol-signing qualification are not claimed. See the [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md). |
| **Bitcoin Logic** | ✅ NATIVE | BDK Kotlin (v0.30.0) |
| **Database** | ✅ NATIVE | Room + SQLCipher (Encrypted) |
| **Integrity** | 🟡 IN PROGRESS | Root detection and Play Integrity token acquisition remain client-side. The wallet-owned centralized value-operation gate now enforces typed fail-closed outcomes, exact request/evidence binding, local replay checks, and native-only value signing. Backend token/attestation verification, durable replay, device/provider/protocol qualification, and production rollout remain pending. See the [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md) and [CON-1546 boundary report](../reports/CON_1546_VALUE_OPERATION_BOUNDARY.md). |

## Central value-operation boundary

`services/value-operation.ts` is the wallet-owned boundary for production value
authorization. Only a typed `allowed` result can reach the native signer;
`rejected`, `quarantined`, `simulated`, and `unsupported` results cannot sign,
broadcast, settle, or be rendered as success. Current callers remain
quarantined until an authoritative external verifier supplies evidence bound to
the exact envelope digest. See the
[CON-1546 boundary report](../reports/CON_1546_VALUE_OPERATION_BOUNDARY.md).

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
