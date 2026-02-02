# Conxius Wallet PRD (Android-First)

## 1. Product Overview

Conxius is a **Multi-Chain Sovereign Interface**, an offline-first Android wallet that bridges the Bitcoin ecosystem (L1, Lightning, Stacks, Rootstock, Liquid, Nostr) with interlayer execution capabilities, including Wormhole-based Native Token Transfers (NTT).

The primary differentiator is the **Native Enclave Core**: keys for all supported protocols are generated and used within a hardened boundary (Android Keystore + memory-only seed handling) and never leave the device's secure memory.

## 2. Competitive Benchmarking & Strategy (Exco Committee)

Conxius aims to exceed the "Cold Storage" utility of **Ledger/Trezor/Foundation** by integrating live L2/Interlayer execution, and the "Web3 Agility" of **MetaMask** by anchoring all multi-chain derivations in a Bitcoin-First sovereign root.

### 2.1. Strategic Pillars
- **Sovereign Superiority**: Unlike BlueWallet or Phoenix, Conxius manages its own L2 peg-in proofs natively in the Enclave.
- **Unified Interlayer**: While MetaMask focuses on EVM, Conxius treats EVM (Rootstock) as a Bitcoin-adjacent execution layer, utilizing Wormhole NTT for non-wrapped asset mobility.
- **Monetization**: Fee capture via NTT Bridge execution and premium Node services (Greenlight LSP).
- **Institutional Readiness**: Vault Policy management (Daily limits, multi-sig quorum) enforced at the Secure Enclave level.

### 2.2. Industry Benchmarking (2024 Analysis)

| Competitor | Core Strength | Conxius Advantage |
| :--- | :--- | :--- |
| **Zeus / Phoenix** | Deep Lightning UX | Conxius anchors Lightning in a multi-chain Enclave, allowing sBTC/LBTC swaps without external trust. |
| **Ledger / Trezor** | Hardware Security | Conxius provides "Hardware security without the dongle" via Android TEE, plus native L2 execution which HW wallets lack. |
| **MetaMask** | Web3 Ecosystem | Conxius applies "Web3 Agility" to the Bitcoin ecosystem while maintaining a Bitcoin-first sovereign root. |
| **BlueWallet** | Multi-account BTC | Conxius expands multi-account utility to Nostr, Identity, and NTT Bridging. |

## 3. User Personas

- **The Sovereign Hodler**: Wants deep cold storage security on a mobile device. Uses Conxius as a daily driver for small-to-medium amounts, trusting the Android TEE.
- **The Interlayer Explorer**: Moves assets between Bitcoin L1 and rollups/sidechains (Stacks, Liquid, RSK). Needs a reliable bridge client that verifies attestations locally.
- **The Social Nomad**: Uses Nostr for uncensored communication and identity (NIP-06), requiring a secure signer that doesn't expose keys to web relays.
- **The Node Operator**: Connects to their own LND/Core node for privacy via the embedded Breez SDK Greenlight client or remote connection.

## 3. User Journeys

### 3.1. Onboarding (Unified Flow)

- **Trigger**: First launch.
- **Flow (Create)**:
  1. Splash screen (Boot sequence).
  2. "Create Vault" selected.
  3. Wallet Type selection (Single, Multi-sig, Hot).
  4. Entropy gathering via local noise.
  5. PIN creation (4-8 digits) and optional BIP-39 passphrase.
  6. Seed generation and display.
  7. **Verification**: User must confirm 3 random words from the mnemonic.
  8. Enclave derivation and initialization.
- **Flow (Import)**:
  1. "Import Recovery" selected.
  2. Mnemonic entry (12/24 words) with BIP-39 validation.
  3. PIN creation and optional passphrase.
  4. Enclave derivation and initialization.

### 3.2. Daily Spend (BTC L1)

- **Trigger**: User wants to send BTC.
- **Flow**:
  1. Scan QR or paste address.
  2. Enter amount (Fiat/BTC toggle).
  3. Review fee (Low/Med/High).
  4. "Slide to Pay".
  5. Auth challenge (Biometric/PIN) triggers Native Enclave signing.
  6. Success screen (TxID + Explorer link).
  7. Notification when confirmed.

### 3.3. Lightning Payment (0-Gas)

- **Trigger**: User scans LNURL/BOLT11.
- **Flow**:
  1. App parses intent (Pay/Withdraw).
  2. Shows amount/description.
  3. Confirm payment.
  4. **Enclave Action**: Seed is decrypted natively and passed directly to Breez SDK memory (Zero-Leak).
  5. Instant settlement toast.

### 3.4. Sovereign Identity (Nostr & D.iD)

- **Trigger**: User logs into a Nostr client or D.iD service.
- **Flow**:
  1. "Connect Identity".
  2. **Enclave Action**: NIP-06 private key is derived on-demand from master seed (`m/44'/1237'/...`).
  3. Public Key (`npub`) is returned to UI.
  4. Events are signed natively without exposing the private key (`nsec`).

### 3.5. Multi-Chain Bridge (Native Pegs & NTT)

- **Trigger**: User wants to move BTC to L2 (Stacks/Liquid) or move assets via NTT.
- **Flow (Native Peg-in)**:
  1. Select "Native Peg" (e.g., BTC → sBTC).
  2. App generates peg-in script/address.
  3. Enclave signs BTC L1 funding tx with OP_RETURN (Stacks) or to Federation Multisig (Liquid).
  4. Monitoring service tracks confirmations.
  5. (Liquid) Enclave signs "Peg-in Claim" tx after 102 confirmations.
- **Flow (NTT Execution)**:
  1. Select NTT route (e.g. sBTC on Stacks → sBTC on Rootstock).
  2. Enclave signs source burn/lock tx.
  3. App retrieves VAA from Wormhole Guardians.
  4. Enclave authorizes destination mint/unlock.

### 3.6. 0-Gas Sovereign Operations

- **Identity**: NIP-06/DID derivation.
- **Communication**: P2P Encrypted Messaging (Nostr NIP-44) using derived keys.
- **Off-chain Transfers**: Ark/State Chain virtual UTXO management.

## 4. Functional Requirements

### 4.1. Key Management (Native Enclave Core)

- **FR-KEY-01**: Master Seed must be encrypted at rest using Android Keystore AES-GCM.
- **FR-KEY-02**: Recovery Phrase (Mnemonic) must be encrypted and stored in `mnemonicVault` for future secure retrieval.
- **FR-KEY-03**: Decrypted seed must reside in memory only during signing/startup and be zeroed immediately after.
- **FR-KEY-04**: Biometric authentication must be required to decrypt the master seed or mnemonic for high-value operations.
- **FR-KEY-05**: Support standard derivation paths:
  - Bitcoin (Native Segwit): `m/84'/0'/0'/0/0`
  - Bitcoin (Taproot): `m/86'/0'/0'/0/0`
  - Stacks: `m/44'/5757'/0'/0/0`
  - Rootstock (EVM): `m/44'/60'/0'/0/0`
  - Liquid: `m/84'/1776'/0'/0/0`
  - Nostr: `m/44'/1237'/0'/0/0`

### 4.2. Transactions

- **FR-TX-01**: Must support BIP-84 (Native Segwit) derivation.
- **FR-TX-02**: Must parse and validate BIP-21 URIs.
- **FR-TX-03**: Must prevent dust outputs during coin selection.
- **FR-TX-04**: Support atomic swaps and peg-ins/peg-outs where applicable.

### 4.2.1. Wormhole NTT (Native Token Transfers)

- **FR-NTT-01**: Full execution lifecycle: Source signing → VAA Retrieval → Destination redemption.
- **FR-NTT-02**: No NTT "VAA" (Verified Action Approval) can be broadcast without a local Conclave-generated proof.
- **FR-NTT-03**: Support for Multi-Asset tracking and redemption (sBTC, USDC, etc.).

### 4.2.2. Sovereign Bridge Protocol

- **Root Alignment**: All multi-chain assets, including NTT-bridged tokens, are slaves to the Bitcoin-root Conclave. ETH addresses are treated as deterministic derivatives.
- **Identity Mapping**: NTT operations (Burn/Mint) are mapped to BTC-anchored identities.
- **Authorization**: No "VAA" (Verified Action Approval) can be broadcast without a local Conclave-generated proof (P-256 or Schnorr).
- **Logic Isolation**: Bridge transceiver logic functions as a "messenger" preparing payloads for the Conclave, rather than an independent signing entity.

### 4.4. Native Pegs (L2 Integration)

- **FR-PEG-01 (sBTC)**: Support for sBTC peg-in (BTC L1 tx with OP_RETURN) and peg-out.
- **FR-PEG-02 (Liquid)**: Support for LBTC peg-in (Multisig funding + Claim proof) and peg-out (burn tx).
- **FR-PEG-03**: Automated confirmation tracking for peg-in transactions.

### 4.3. Connectivity

- **FR-NET-01**: All external API calls must be user-auditable (list of endpoints).
- **FR-NET-02**: Support for Greenlight (Breez SDK) for non-custodial Lightning.

### 4.5. Backup & Restore

- **FR-BR-01**: Users can view their recovery phrase after providing their PIN/Biometrics.
- **FR-BR-02**: Users can export an encrypted JSON vault backup for off-device storage.
- **FR-BR-03**: The app tracks backup verification status and incorporates it into the Sovereignty Score.
- **FR-BR-04 (Health Check)**: Support for periodic "Health Checks" where users verify a subset of their mnemonic to ensure physical backup integrity.
- **FR-BR-05 (Decoy Vault)**: Support for a secondary "decoy" PIN that opens a limited/simulated vault (Duress Mode alignment).

### 4.6. Privacy & Advanced Protocols
- **FR-PRIV-01 (Silent Payments)**: Support for BIP-352 key derivation (m/352') and sp1-encoded address generation.
- **FR-PRIV-02**: Enclave-authorized scanning for incoming silent payment outputs.
- **FR-PRIV-03**: Private sending capability to sp1 addresses using sender's UTXO set.
- **FR-PRIV-04 (Taproot Assets)**: Infrastructure readiness for Taproot Assets (BIP-341/342).
- **FR-PRIV-05 (Privacy Score)**: Implementation of a Privacy Metric that weighs usage of Silent Payments, Confidential Transactions, and UTXO hygiene.

## 5. Non-Functional Requirements

### 5.1. Security

- **NFR-SEC-01**: No sensitive data in logs (seed, private keys, macaroons).
- **NFR-SEC-02**: App preview in "Recents" must be obscured (FLAG_SECURE).
- **NFR-SEC-03**: Root detection warning on startup.
- **NFR-SEC-04**: 0-Gas efficiency for Identity and Lightning Auth.

### 5.2. Reliability

- **NFR-REL-01**: App must work offline (view cached state).
- **NFR-REL-02**: Bridge state must persist across app restarts.

### 5.3. Performance

- **NFR-PERF-01**: Cold launch to Lock Screen < 1s.
- **NFR-PERF-02**: Unlock to Dashboard < 2s.
- **NFR-PERF-03**: Identity derivation < 200ms (cached).

## 6. Release Strategy

- **Alpha (Internal)**: Debug builds, mock assets.
- **Beta (Testnet)**: Public testnet builds, real crypto disabled or testnet-only.
- **Production**: Mainnet enabled, strict security review, APK signing with release keys.

## 7. Continuous Improvement

- **PRD Updates**: This document is the source of truth. Any architectural change (e.g., adding a new chain) triggers a PRD update PR.
- **Testing**: Every PR must pass `testDebugUnitTest` for Android and `npm test` for logic.
- **Verification**: Release builds are verified on physical Pixel devices before publication.

## 8. Sovereign Expansion Architecture

To achieve the "Great Unification" of Bitcoin layers, Conxius leverages a hybrid architecture of native JNI (Rust) and Capacitor (JS) interfaces.

### 8.1. Layer Unification Matrix

| Protocol | Conclave Integration Path | Turnkey SDK Reference | Status |
| :--- | :--- | :--- | :--- |
| **Bitcoin L1** | Native Rust (BDK) | [BDK](https://bitcoindevkit.org/) | PRODUCTION |
| **Lightning** | JNI Bridge (Greenlight) | [Breez SDK](https://breez.technology/) | PRODUCTION |
| **Stacks** | Capacitor (Stacks.js) | [Stacks.js](https://github.com/hirosystems/stacks.js) | PRODUCTION |
| **Liquid** | GDK Integration | [Blockstream GDK](https://github.com/Blockstream/gdk) | PRODUCTION |
| **Rootstock** | Web3 / Ethers.js | [Web3.js](https://web3js.org/) | PRODUCTION |
| **Ark** | Native ASP Client | [Ark Research](https://ark-protocol.org/) | RESEARCH |
| **Statechains**| Mercury Integration | [Mercury Layer](https://mercurylayer.com/) | RESEARCH |
| **BitVM** | Fraud Proof Verifier | [BitVM.org](https://bitvm.org/) | RESEARCH |
| **Citrea** | ZK-STARK Verifier | [Citrea.xyz](https://citrea.xyz/) | RESEARCH |
| **Botanix** | EVM-compatible Bridge | [Botanix Labs](https://botanixlabs.xyz/) | TESTNET |

### 8.2. Advanced Feature Requirements (Phase 2)

- **FR-EXP-01 (Ordinals/Runes)**: Enclave-authorized coin selection to prevent accidental burning of digital artifacts.
- **FR-EXP-02 (BitVM Verification)**: Local verification of BitVM fraud proofs within the Enclave's memory boundary.
- **FR-EXP-03 (Virtual UTXOs)**: Support for Ark-style virtual UTXOs, enabling instant, low-fee L1 transfers.
- **FR-EXP-04 (Atomic Swaps)**: Trustless cross-layer swaps (e.g., Lightning <-> Liquid) using Submarine Swaps or PTLCs.
