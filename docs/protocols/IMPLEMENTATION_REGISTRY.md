---
title: Implementation Registry
layout: page
permalink: /docs/implementation-registry
---

# Conxius Implementation Registry (v1.9.5)

## I. CORE PROTOCOLS

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Bitcoin L1 value execution** | 🛑 CONTAINED / UNAVAILABLE | Construction and native custody surfaces exist. Signer-produced artifacts have process-local PSBT→final-transaction provenance and exact authorization binding; a valid attempt consumes `broadcast` once, then returns unsupported. No provider I/O, receipt, submission, finality, or settlement is supported. |
| **Clean-block fee model (inscription-resistant)** | 🟡 IN PROGRESS | `services/bitcoin-fee-oracle.ts` samples bounded confirmed blocks, excludes narrowly detected inscription envelopes, and falls back to the existing fee endpoint. This is an independent client-side fee heuristic — **not** BIP-110 (a Closed consensus softfork unrelated to fees); see [clean-block fee model](../operations/CLEAN_BLOCK_FEE_MODEL.md). |
| **BIP-352 Silent Payments** | 🟡 IN PROGRESS | Merged PR #390 implements bounded Rust/JNI scanning, Kotlin Esplora ingestion with cursor/persistence and shallow reorg fail-closed checks, plus a public-only Compose scan card. Pending release validation, mobile evidence, compact-filter discovery, spending/tweak recovery, native address encoding, authoritative spentness, and raw/merkle proof coverage. |
| **Lightning payments** | 🟡 IN PROGRESS | Native BOLT-11 signing primitive (`LightningInvoiceSigner`: Bech32 message hash + compact ECDSA `r\|\|s\|\|recid` via `EvmSigner`) reachable from TS via `SecureEnclavePlugin.lightningInvoiceMessageHash`/`lightningSignInvoice`/`lightningRecoverInvoicePublicKey`. Channel management and payment routing (Breez/LDK) remain provider-gated; no synthetic preimage or txid can satisfy success. |
| **Babylon Staking** | 🟡 IN PROGRESS | Native Taproot signing (BIP-340 Schnorr + BIP-341 tweak + BIP-86 P2TR + BIP-350 bech32m) in PR #641; reachable from TS via `SecureEnclavePlugin.taprootAddress`/`schnorrSignDigest`. Babylon transaction layout and unbonding remain TS/API-layer. |
| **NIP-47 (NWC)** | 🟡 IN PROGRESS | Native NIP-01/NIP-47 event signing (`NostrSigner`: event-id + BIP-340 Schnorr sign/verify) reachable from TS via `SecureEnclavePlugin.nostrGetPubkey`/`nostrSignEvent`/`nostrVerifyEvent`; `NwcManager` is a stateless facade over it. Relay transport (NIP-04/44 + a Nostr relay) remains provider-gated. |
| **DLC (Discreet Log)** | 🟡 IN PROGRESS | Native Schnorr adaptor-signature primitive (`AdaptorSigner`: pre-sign/verify/complete/extract over a shared nonce point) reachable from TS via `SecureEnclavePlugin.dlcAdaptorSign`/`dlcAdaptorVerify`/`dlcAdaptorPoint`/`dlcCompleteSignature`/`dlcExtractSecret`. CET construction and oracle attestation transport remain provider-gated; no qualified adapter receipt. |
| **sBTC Bridge** | 🟡 IN PROGRESS | Stacks signing is native (PR #640); the sBTC Clarity bridge contract and full peg flow are tracked separately and not yet end-to-end. |
| **Ark** | 🛑 CONTAINED / UNAVAILABLE | Forfeit/redeem artifacts are exactly bound; reviewed production execution returns typed unsupported rather than synthetic txids. Blocked on covenant opcodes (CTV/BIP-119) which remain draft. |
| **StateChain** | 🛑 CONTAINED / UNAVAILABLE | Transfer/withdrawal artifacts are exactly bound; no production provider/finality receipt is qualified. |
| **Maven** | 🛑 CONTAINED / UNAVAILABLE | Transfer artifacts are exactly bound; Marketplace remains preview-only and cannot report payment/delivery completion. |
| **Liquid** | 🟡 IN PROGRESS | Native `LiquidSigner` (unconfidential sighash DER + P2WPKH bech32) in PR #640; confidential assets (Pedersen commitments, range proofs, Blech32) remain in `liquidjs-lib`. |
| **EVM (BOB/RSK)** | ✅ PRODUCTION | Native `EvmSigner` (EIP-155/1559/712) merged in PR #638; reachable from TS via `SecureEnclavePlugin.evmAddress/evmSignTransaction/evmSignDigest`. |
| **Musig2** | 🟡 IN PROGRESS | Native BIP-327 crypto in `Musig2Signer` (KeyAgg + ApplyTweak, NonceGen/Agg, Sign, PartialSigVerify, PartialSigAgg) with BIP-327 conformance vectors (key_agg, key_sort, nonce_agg, sig_agg, sign_verify). `Musig2Manager` is a real facade (no `failClosed`). Capacitor bridge wired (7 `SecureEnclavePlugin.musig2*` endpoints) + TS session coordination (`services/musig2.ts` `Musig2Session` delegates to native KeyAgg/NonceGen/Sign/Verify/Agg; no more naive noble-curves sum). Remaining: consumer PSBT/session UX + mobile evidence. |
| **Stacks** | ✅ PRODUCTION | Native `StacksSigner` (SIP-005 c32check + SIP-018 SHA512/256) in PR #640; reachable from TS via `SecureEnclavePlugin.stacksAddress/stacksSignDigest`. |
| **RGB** | 🛑 CONTAINED / UNAVAILABLE | Issuance/transfer paths use typed exact binding and cannot return synthetic production success; native/provider qualification remains absent. |
| **BitVM2** | 🔬 RESEARCH / QUARANTINED | Typed proof-envelope validation only. No reviewed wallet verifier, segment backend, challenge source, or authoritative dispute signer exists. |
| **Web5** | ✅ PRODUCTION | Native Web5Manager + Web5 API (TS). |
| **Yield (Yield.xyz)** | 🟡 DISCOVERY ONLY / EXECUTION UNAVAILABLE | Non-value discovery can remain visible; reviewed entry actions do not submit value operations. |
| **Insurance (Parametric)**| 🛑 CONTAINED / UNAVAILABLE | Reviewed purchase/settlement paths cannot claim production completion without qualified evidence and receipts. |
| **Interoperability / swaps / NTT** | 🛑 CONTAINED / UNAVAILABLE | Wormhole/NTT, bridge, and swap execution paths use typed containment or explicit unsupported outcomes before side effects. |
| **B2B Gateway** | 🛑 CONTAINED / UNAVAILABLE | `B2bManager` remains `failClosed`; gated on the Conxian Gateway deploy (#466). |
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

Bitcoin broadcast additionally requires the exact frozen
`SignedBitcoinValueOperation` registered by the native signer. Its private
record binds the authorization/capability, envelope and PSBT digests, retained
PSBT, unsigned transaction intent, final transaction digest, and network.
Broadcast recomputes and compares ordered inputs/outputs plus version and
locktime, ignoring only finalization-added scriptSig/witness fields. Valid local
attempts consume `broadcast` and return
`unsupported: qualified_provider_unavailable`; rejected attempts do not consume
the stage and no network/provider call exists.

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

## V. SECURITY & CI/CD INFRASTRUCTURE HARDENING

| Component | Status | Notes |
| :--- | :--- | :--- |
| **Gitleaks (Primary)** | ✅ PRODUCTION | Pinned, checksum-verified tokenless CLI scan running on full repository history. |
| **GitGuardian (Secondary)** | ✅ PRODUCTION | Optional secondary secret scanning configured to fail-safe via `continue-on-error: true` to prevent third-party credential drift or invalid/expired API keys from blocking development CI. |

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
