# MASTER PRD: Conxius Wallet (Production Release)

## 1. Executive Summary

**Product:** Conxius Wallet, a "Bitcoin-First" mobile wallet with a native Secure Enclave.
**Mission:** Deliver hardware-level security on a mobile device, enabling sovereign management of Bitcoin L1 and L2 assets.
**Value Proposition:** *Hardware-level security without the dongle.*
**Monetization:** Capture fees on cross-chain NTT executions and gas abstraction services.

---

## 2. Business State: [ALL COMPLETED]

- **[MARKET_FIT]:** [COMPLETED]
- **[RISK_COMPLIANCE]:** [COMPLETED]
- **[TOKENOMICS]:** [COMPLETED]
- **[ROADMAP]:** [COMPLETED]

---

## 3. Core Product & Technical Specifications

*(This section is a summary of the detailed PRD.md)*

### 3.1. Architecture

- **Multi-Chain Sovereign Interface:** An offline-first Android wallet bridging the Bitcoin ecosystem (L1, Lightning, Stacks, Rootstock, Liquid, Nostr).
- **Native Enclave Core:** All cryptographic operations (key generation, signing) are handled within a hardware-backed secure environment on the user's device.
- **Wormhole NTT Integration:** Native Token Transfers are supported for seamless cross-chain asset movement without wrapped assets.

### 3.2. Key User Journeys

- **Onboarding:** Secure wallet creation/import with mandatory seed backup verification.
- **Daily Spend (BTC & Lightning):** Frictionless payments with biometric authentication.
- **Multi-Chain Bridge (NTT):** A single, unified authorization flow for complex cross-chain transfers with clear communication of wait times and fees.
- **Gas Abstraction:** Users can opt to auto-swap a portion of their source asset to cover gas fees on the destination chain.

### 3.3. Functional Requirements (Summary)

- **Key Management:** Master seed encrypted at rest via Android Keystore, with in-memory handling only during operations.
- **Transactions:** Support for Native Segwit (BIP-84), BIP-21 URI parsing, and robust coin selection.
- **NTT Execution:** Full lifecycle management from source burn to destination redemption, authorized by the local Conclave.
- **Connectivity:** All external API calls are user-auditable, with support for non-custodial Lightning via Greenlight (Breez SDK).

### 3.4. Non-Functional Requirements

- **Security:** No sensitive data in logs, obscured app preview, and root detection.
- **Reliability:** Offline functionality for viewing cached state and persistent bridge state across restarts.
- **Performance:** Sub-second cold launch to lock screen and sub-two-second unlock to dashboard.

---

## 4. Production-Ready UX Flow: The Sovereign Handshake

The final user experience for NTT transfers is designed to be a "Sovereign Handshake." A complex, multi-stage, cross-chain operation is reduced to a single user authorization, followed by a persistent, non-blocking status tracker that communicates each stage of the process (Source Confirmation, VAA Generation, Destination Redemption).

This flow is implemented in the `NTTBridge.tsx` component and documented in `docs/UX_FLOW_FINAL.md`.

---

## 5. Release & Deployment Strategy

- **Release Channel:** Production (Mainnet enabled).
- **Security:** All release builds undergo a strict internal security review and are signed with official release keys.
- **Verification:** Builds are verified on physical Pixel devices before publication.
- **Continuous Improvement:** This `MASTER_PRD.md` is the source of truth. Any significant architectural changes must be reflected here. All PRs must pass the full test suite.
