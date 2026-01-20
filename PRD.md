# Conxius Wallet PRD (Android-First)

## 1. Product Overview

Conxius is a sovereign, offline-first Android wallet that bridges the Bitcoin ecosystem (L1, Lightning, Stacks, Rootstock) with interlayer execution capabilities (Wormhole/NTT).

The primary differentiator is the "Enclave Model": keys are generated and used within a hardened boundary (Android Keystore + memory-only seed handling) and never leave the device.

## 2. User Personas

- **The Sovereign Hodler**: Wants deep cold storage security on a mobile device. Uses Conxius as a daily driver for small-to-medium amounts, trusting the Android TEE.
- **The Interlayer Explorer**: Moves assets between Bitcoin L1 and rollups/sidechains. Needs a reliable bridge client that verifies attestations locally.
- **The Node Operator**: Connects to their own LND/Core node for privacy.

## 3. User Journeys

### 3.1. Onboarding (New Wallet)

- **Trigger**: First launch.
- **Flow**:
  1. Splash screen (Boot sequence).
  2. "Create Wallet" vs "Import Wallet".
  3. PIN creation (6+ digits).
  4. Seed generation (BIP-39).
  5. **Critical**: User must verify backup (e.g., select words 3, 7, 12).
  6. Biometric enrollment (optional but encouraged).
  7. Dashboard loads.

### 3.2. Daily Spend (BTC L1)

- **Trigger**: User wants to send BTC.
- **Flow**:
  1. Scan QR or paste address.
  2. Enter amount (Fiat/BTC toggle).
  3. Review fee (Low/Med/High).
  4. "Slide to Pay".
  5. Auth challenge (Biometric/PIN).
  6. Success screen (TxID + Explorer link).
  7. Notification when confirmed.

### 3.3. Lightning Payment

- **Trigger**: User scans LNURL/BOLT11.
- **Flow**:
  1. App parses intent (Pay/Withdraw).
  2. Shows amount/description.
  3. Confirm payment.
  4. Background execution via LND REST.
  5. Instant settlement toast.

### 3.4. Bridge Execution (Wormhole)

- **Trigger**: User wants to move BTC -> Wrapped Asset.
- **Flow**:
  1. Select Source (BTC) and Dest (e.g., Ethereum/Solana).
  2. "Lock" transaction on BTC.
  3. App polls for VAA (Guardian attestation).
  4. App prompts "Redeem" transaction on Dest chain.
  5. Completion receipt.

### 3.5. Emergency Wipe

- **Trigger**: Duress or lost PIN.
- **Flow**:
  1. From Lock Screen: "Forgot PIN?" -> "Reset Wallet".
  2. Warning: "This will delete all keys. Ensure you have your backup."
  3. Confirm wipe.
  4. App reboots to onboarding state.

## 4. Functional Requirements

### 4.1. Key Management

- **FR-KEY-01**: Seed must be encrypted at rest using Android Keystore AES-GCM.
- **FR-KEY-02**: Decrypted seed must reside in memory only during signing operations and be zeroed immediately after.
- **FR-KEY-03**: Biometric authentication (when enabled) must be required to decrypt the master seed.

### 4.2. Transactions

- **FR-TX-01**: Must support BIP-84 (Native Segwit) derivation.
- **FR-TX-02**: Must parse and validate BIP-21 URIs.
- **FR-TX-03**: Must prevent dust outputs during coin selection.

### 4.3. Connectivity

- **FR-NET-01**: All external API calls must be user-auditable (list of endpoints).
- **FR-NET-02**: Support for user-provided LND REST endpoint + macaroon.

## 5. Non-Functional Requirements

### 5.1. Security

- **NFR-SEC-01**: No sensitive data in logs (seed, private keys, macaroons).
- **NFR-SEC-02**: App preview in "Recents" must be obscured (FLAG_SECURE).
- **NFR-SEC-03**: Root detection warning on startup.

### 5.2. Reliability

- **NFR-REL-01**: App must work offline (view cached state).
- **NFR-REL-02**: Bridge state must persist across app restarts (don't lose an in-flight transfer).

### 5.3. Performance

- **NFR-PERF-01**: Cold launch to Lock Screen < 1s.
- **NFR-PERF-02**: Unlock to Dashboard < 2s.

## 6. Release Strategy

- **Alpha (Internal)**: Debug builds, mock assets.
- **Beta (Testnet)**: Public testnet builds, real crypto disabled or testnet-only.
- **Production**: Mainnet enabled, strict security review, APK signing with release keys.
