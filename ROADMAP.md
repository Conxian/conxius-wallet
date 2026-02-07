---
title: Project Roadmap
layout: page
permalink: /roadmap
---

# Conxius Wallet Roadmap (Implementation-Grade)

## North Star

- Android-first, offline-first wallet for Bitcoin L1 and Bitcoin-adjacent layers, with an explicit interlayer (Wormhole/NTT) execution roadmap.
- Zero secret egress by default: keys and credentials never leave the device without explicit, user-reviewed export.
- “Truthful shipping”: features are either implemented to standard or gated off (no placeholders in production UX).

## Standards Adherence (Non-Negotiable)

- **Bitcoin**
  - BIP-32/39/84 derivation and mnemonic handling
  - BIP-174 PSBT for signing flows
  - BIP-21 for payment URIs
  - BIP-125 for RBF support (when fee bumping ships)
  - BIP-322 only when fully correct (otherwise not exposed as “supported”)
- **Lightning**
  - BOLT11 parsing and invoice safety checks
  - LNURL (LUD specs) with strict input validation and safe networking rules
  - LND REST best practices: scoped macaroons, no logging, explicit user consent
- **Interlayer / Wormhole**
  - NTT execution lifecycle: source tx → attestation/VAA → destination redemption
  - Attestation verification and provider redundancy (no single indexer SPOF)
- **Android Security**
  - Android Keystore AES-GCM with user-auth gated keys for vault protection
  - Secure UI constraints: lock on background, avoid leaking in recents/screenshots

## Quality Gates (Definition of Done)

- Tests: unit tests for crypto + transaction building; integration tests for migrations and signing.
- Security: threat model section updated for any secret-handling changes; no secrets in logs; credential classification documented.
- Correctness: reference vectors where applicable (deterministic address derivation, PSBT validity).
- UX: capability gating (incomplete features are hidden or labeled “experimental”).
- Release hygiene: CHANGELOG entry, version bump policy, migration notes when formats change.

## Current State (Implemented)

- **Unified Onboarding**: Create and Import flows with mandatory backup verification.
- **Secure Persistence**: Encrypted state vault with `mnemonicVault` support and auto-migrations.
- **Android SecureEnclave**: Backed by Keystore AES-GCM and user authentication gating.
- **Advanced Security**: Auto-lock, duress PIN, biometric gating, and functional "View Recovery Phrase".
- **Vault Mobility**: Encrypted JSON vault export for sovereign backups.
- **BTC L1 Transaction Pipeline**: Full PSBT lifecycle (Build → Sign → Broadcast), Taproot (BIP-341) support, and Dust detection.
- **Lightning Integration**: BOLT11/LNURL parsing and LND REST backend plumbing.
- **Interlayer Interop**: Wormhole/NTT tracking and real-time protocol diagnostics.
- **Privacy Core**: Full Taproot (BIP-341) signing and Silent Payments (BIP-352) key management.
- **Sovereign Layers (L2)**: Stacks BNS (.btc) resolution, Nakamoto/sBTC readiness, and Liquid Confidentiality audits.
- **AI Integration**: Gemini-powered Protocol Auditor and Yield Optimizer for sovereign risk analysis.
- **Satoshi AI Privacy Scout**: Proactive UTXO management and privacy recommendations.

## Sovereign Expansion Milestones

### M1 — Notifications + Event Model (Local-First) [COMPLETED]

**Scope**

- Local notifications for tx lifecycle and security events.
- A canonical `WalletEvent` taxonomy that drives both toasts and OS notifications.
**Acceptance Criteria**
- Notifications for: tx submitted, tx confirmed, tx failed; auto-lock triggered; vault write blocked by auth.
- No secret material in notification payloads.
- User can disable notifications; app behaves correctly without permissions.

### M2 — Transaction Lifecycle + Reliability (BTC L1)

**Scope**

- Persisted tx history and confirmation tracking; failure recovery.
- Fee management: Real-time multi-layer fee estimation, RBF (BIP-125), and safe defaults.
**Acceptance Criteria**
- Pending txs persist across app restarts; confirmations update deterministically.
- RBF bumps produce valid transactions and do not break history.

### M3 — PSBT Correctness + Privacy

**Scope**

- Coin selection, script-type validation, dust/change policy, address reuse avoidance.
**Acceptance Criteria**
- PSBT creation validates UTXO script type and refuses unsupported scripts with clear UX.
- Coin selection prevents dust outputs and minimizes linkability (documented heuristics).

### M4 — Wormhole/NTT Execution (Interlayer) [COMPLETED]

**Scope**

- Turn tracking into execution: source tx creation/signing, VAA retrieval/verification, destination redemption.
**Acceptance Criteria**
- Bridge flow is a state machine with recoverability at each phase.
- VAA/attestation data is verified and fetched from at least two providers.

### M5 — Multi-Wallet / Multi-Account

**Scope**

- Multiple vault slots; explicit switching; isolated histories and credentials.
**Acceptance Criteria**
- No cross-wallet leakage (state, history, credentials).
- Safe delete/export per wallet with explicit confirmations.

### M6 — Native L2 Pegs (sBTC & LBTC)

**Scope**

- Native Peg-in/Peg-out state machines.
- Support for Stacks sBTC (Nakamoto) and Liquid LBTC.
**Acceptance Criteria**
- Peg-in transactions generated with correct OP_RETURN/Multisig scripts.
- Automated tracking of 102 confirmations for Liquid.
- Enclave-authorized peg-in claim/redemption.

### M7 — Institutional Policy Vaults (Policy-Gated Enclave)

**Scope**

- Vault-level spend policies (Daily limits, Whitelisted addresses).
- Multi-sig quorum (M-of-N) with hardware/remote participants.
**Acceptance Criteria**
- Enclave refuses to sign if policy is violated (enforced natively).
- Quorum collection UI for multi-sig coordination.

### M8 — Privacy Scoring & Backup Health [COMPLETED]

**Scope**

- Implement "Privacy Score" engine in the Sovereign Meter.
- Add "Backup Health Check" UI for mnemonic audit.
- Unified Transaction Timeline view across all layers.
**Acceptance Criteria**
- Privacy score reflects usage of BIP-352 and Confidential Transactions.
- Health Check confirms user still possesses the correct recovery phrase.
- **Satoshi AI Privacy Scout** provides proactive UTXO consolidation and privacy advice.

### M9 — The Great Unification (Phase 1: Artifacts & Experimental)

**Scope**

- Ordinals/Runes safety checks (Coin Control 2.0).
- Ark V-UTXO demo on Testnet.
- Botanix/Citrea Bridge tracking.
**Acceptance Criteria**
- UTXO manager prevents spending "Inscribed" outputs without explicit override.
- Ark SDK integrated into the Enclave JNI layer.

### M10 — BitVM & ZK-Proofs (Phase 2: Verifier Core)

**Scope**

- BitVM Fraud Proof Verifier integrated into the Enclave.
- ZK-STARK verification for Citrea/Rollup state transitions.
**Acceptance Criteria**
- Enclave can verify an off-chain fraud proof without a full node.
- Real-time "Proof Health" dashboard.

## Go-to-Market Alignment

This section maps the technical milestones defined in "Sovereign Expansion Milestones" to their corresponding business and marketing initiatives.

-   **M4 — Wormhole/NTT Execution (Interlayer):**
    -   **Biz:** "Unwrap Your Bitcoin" Campaign Launch. This campaign will highlight the ability to move assets seamlessly between Bitcoin and other chains without relying on wrapped assets.
-   **M6 — Native L2 Pegs (sBTC & LBTC):**
    -   **Biz:** "Bringing Smart Contracts to Bitcoin" campaign. This campaign will focus on the new possibilities unlocked by bringing smart contract functionality to Bitcoin through L2s and sidechains.

## Notification Strategy

- Phase 1: Android local notifications (on-device only).
- Phase 2: Optional push notifications (FCM) only when there is a server component and a privacy review.
