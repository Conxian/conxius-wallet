---
title: Implementation Registry
layout: page
permalink: /docs/implementation-registry
---

# Conxius Implementation Registry (v1.9.5)

## I. CORE PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Bitcoin L1 value execution** | 🛑 CONTAINED / UNAVAILABLE | Construction and native custody surfaces exist, but issue #444 requires exact gate-bound authorization and the qualified broadcast provider/receipt is unavailable. No production submission is supported. |
| **BIP-110 client-side fee alignment** | 🟡 IN PROGRESS | `services/bitcoin-fee-oracle.ts` samples bounded confirmed blocks, excludes narrowly detected inscription envelopes, and falls back to the existing fee endpoint. This is client-side policy, not consensus compliance; see [BIP-110 alignment](../operations/BIP110_COMPLIANCE.md). |
| **BIP-352 Silent Payments** | 🟡 IN PROGRESS | Merged PR #390 implements bounded Rust/JNI scanning, Kotlin Esplora ingestion with cursor/persistence and shallow reorg fail-closed checks, plus a public-only Compose scan card. Pending release validation, mobile evidence, compact-filter discovery, spending/tweak recovery, native address encoding, authoritative spentness, and raw/merkle proof coverage. |
| **Lightning payments** | 🛑 CONTAINED / UNAVAILABLE | Reviewed Breez/TS/backend payment paths return typed unsupported outcomes before payment; no synthetic preimage or txid can satisfy success. |
| **Babylon Staking** | ✅ PRODUCTION | Native Taproot staking for Babylon protocol. |
| **NIP-47 (NWC)** | ✅ PRODUCTION | Native NwcManager + TS event support. |
| **DLC (Discreet Log)** | 🛑 CONTAINED / UNAVAILABLE | Offer construction may exist, but acceptance/settlement execution requires exact `{ authorization, artifact }` binding and has no qualified adapter receipt. |
| **sBTC Bridge** | ✅ PRODUCTION | Clarity 4.0 contract in `core/stacks-bridge.clar`. |
| **Ark** | 🛑 CONTAINED / UNAVAILABLE | Forfeit/redeem artifacts are exactly bound; reviewed production execution returns typed unsupported rather than synthetic txids. |
| **StateChain** | 🛑 CONTAINED / UNAVAILABLE | Transfer/withdrawal artifacts are exactly bound; no production provider/finality receipt is qualified. |
| **Maven** | 🛑 CONTAINED / UNAVAILABLE | Transfer artifacts are exactly bound; Marketplace remains preview-only and cannot report payment/delivery completion. |
| **Liquid** | ✅ PRODUCTION | Native LiquidManager + TS Liquidjs support. |
| **EVM (BOB/RSK)** | ✅ PRODUCTION | Native EvmManager + TS Ethers support. |
| **Musig2** | ✅ PRODUCTION | Aligned with `@noble/curves`, native session management. |
| **Stacks** | ✅ PRODUCTION | Native StacksManager + Stacks.js (TS). |
| **RGB** | 🛑 CONTAINED / UNAVAILABLE | Issuance/transfer paths use typed exact binding and cannot return synthetic production success; native/provider qualification remains absent. |
| **BitVM2** | 🔬 RESEARCH / QUARANTINED | Typed proof-envelope validation only. No reviewed wallet verifier, segment backend, challenge source, or authoritative dispute signer exists. |
| **Web5** | ✅ PRODUCTION | Native Web5Manager + Web5 API (TS). |
| **Yield (Yield.xyz)** | 🟡 DISCOVERY ONLY / EXECUTION UNAVAILABLE | Non-value discovery can remain visible; reviewed entry actions do not submit value operations. |
| **Insurance (Parametric)**| 🛑 CONTAINED / UNAVAILABLE | Reviewed purchase/settlement paths cannot claim production completion without qualified evidence and receipts. |
| **Interoperability / swaps / NTT** | 🛑 CONTAINED / UNAVAILABLE | Wormhole/NTT, bridge, and swap execution paths use typed containment or explicit unsupported outcomes before side effects. |
| **B2B Gateway** | ✅ PRODUCTION | Native B2bManager + Conxian Gateway integration. |
| **Revenue Automation** | ✅ PRODUCTION | `core/revenue-automation.clar` (1% fee) implemented. |
| **Referral Aggregator** | ✅ PRODUCTION | `core/referral-aggregator.clar` (5-5-5 logic) implemented. |

## III. ASSET PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Ordinals / Runes value transfers** | 🛑 CONTAINED / UNAVAILABLE | No reviewed production transfer may bypass the centralized wallet value-operation boundary. |
| **RGB Assets** | 🛑 CONTAINED / UNAVAILABLE | Typed artifact binding replaces simulation/synthetic success; production provider support is not established. |
| **Taproot Assets** | 🛑 CONTAINED / UNAVAILABLE | Discovery may be non-value; transfer execution is typed and unsupported pending a qualified adapter. |

## IV. NATIVE ARCHITECTURE (PHASE 5)

| Component | Status | Tech Stack |
| :--- | :--- | :--- |
| **UI Layer** | ✅ NATIVE | Jetpack Compose, Material 3 |
| **Secure Enclave** | ✅ NATIVE | Android Keystore with StrongBox requested where supported; existing AES storage may fall back to TEE. Universal StrongBox backing and protocol-signing qualification are not claimed. See the [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md). |
| **Bitcoin Logic** | ✅ NATIVE | BDK Kotlin (v0.30.0) |
| **Database** | ✅ NATIVE | Room + SQLCipher (Encrypted) |
| **Integrity** | 🟡 IN PROGRESS | Root detection is local; Play Integrity SDK `1.6.0` Standard API client/token acquisition is present with opaque-token handling and deterministic request-hash binding. The issue #444 wallet gate contains reviewed execution paths but always returns `unsupported_provider` in production. Backend decryption/verdict verification, Android Key Attestation chain/root/revocation and device qualification, durable replay/freshness, authoritative authorization, and production rollout remain pending. See the [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md). |

## Wallet Value-Operation Gate

Status: **Implemented — fail-closed containment; production execution
unsupported.**

The application boundary is implemented by
`services/value-operation-gate.ts`,
`services/value-operation-evidence-verifier.ts`,
`services/value-operations.ts`,
`services/value-operation-result.ts`,
`services/value-operation-authorization-queue.ts`,
`services/value-signer.ts`, and `services/bitcoin-broadcast.ts`. The canonical
version-1 envelope binds operation, network/domain, challenge, custody identity,
algorithm, and provider/evidence digest fields. Callers must provide exact
`{ authorization, artifact }` requests and handle discriminated outcomes.

The production evidence verifier always returns `unsupported_provider`.
Reviewed value adapters therefore reject malformed/forged/mismatched requests
or return unsupported/quarantined outcomes before side effects. No bare txid,
preimage, boolean, local completion flag, confirmation, native selection, debug
status, or synthetic artifact is authoritative evidence or a provider receipt.
Stage consumption is process-local only and is not durable replay protection.

See the [issue #444 evidence record](../reports/ISSUE_444_VALUE_OPERATION_GATE_CONTAINMENT.md)
for migration and negative-regression inventory.

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
- **CONTAINED / UNAVAILABLE:** Reviewed production entry points fail closed and
  do not execute value operations; provider qualification and receipts remain
  required before any production status.
- **BRIDGED:** Core manager in native Kotlin, high-level logic in TS/React.
- **TS-ONLY:** Logic resides solely in the legacy companion TS service layer.

*Aligned with the current release-baseline evidence. Historical completion
claims do not override the BitVM2 quarantine or the Technical Debt Register.*
