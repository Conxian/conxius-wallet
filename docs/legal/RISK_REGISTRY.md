---
title: Risk Registry
layout: page
permalink: /risk
---

# Conxius Wallet Risk & Compliance Registry

**Last Updated:** 2026-02-18
**Entity:** Conxian Labs
**Jurisdiction:** South Africa (Primary), Global (Secondary)

## 1. Executive Summary
Conxius Wallet is a strictly non-custodial software interface ("The Tool"). It leverages a Trusted Execution Environment (TEE) known as "The Conclave" to ensure Conxian Labs never possesses, manages, or controls user funds. All financial services (Fiat On-Ramps, Swaps) are offloaded to regulated third-party providers or executed via decentralized protocols.

---

## 2. Regulatory Risks (South Africa & Global)

### 2.1 Risk: Classification as a Financial Intermediary (FAIS/CASP)
* **Description:** Risk that the FSCA (SA) classifies Conxius as a Crypto Asset Service Provider (CASP) requiring an FSP license.
* **Mitigation (Technical):**
    * **The Conclave (TEE):** Private keys are generated and stored inside the user's device hardware. Conxian Labs has zero technical ability to access keys.
    * **No Pooling:** User funds are never pooled. Transactions are P2P or Direct-to-Contract.
* **Mitigation (Operational):**
    * **Outsourced Rails:** All fiat-to-crypto transactions are executed by **Transak** and **VALR**. Conxius strictly acts as a UI referral.

### 2.2 Risk: Money Laundering (AML/CFT)
* **Description:** Risk of the platform being used for illicit flows.
* **Mitigation:**
    * **Partner Reliance:** We do not process payments. Partners (Transak/Changelly) perform all KYC/CDD checks on users before allowing value transfer.
    * **Non-Custodial Privacy:** Protocols like **WabiSabi (CoinJoin)** and **Silent Payments** are implemented as decentralized software logic on-device. Conxian Labs does not act as a centralized "mixer" or "custodian" of funds during these operations.

### 2.3 Risk: US Securities Laws (SEC)
* **Description:** Risk of being deemed an unregistered Broker-Dealer for enabling access to swap protocols.
* **Mitigation:**
    * **Direct Routing:** Swap features utilize the **Changelly API** or Decentralized Atomic Swaps. Conxius does not match orders or hold inventory.
    * **UI-Only Role:** The Terms of Service explicitly define the app as a "Self-Hosted Wallet Interface."

---

## 3. Infrastructure Sovereignty (The "Real Rails")

### 3.1 Technical Relays (Proxies)
As part of the **Infrastructure Pivot (M12)**, Conxian Labs operates dedicated proxies for **Changelly** and **Bisq**.
* **Risk:** Potential classification as an intermediary.
* **Mitigation:** These proxies are strictly **Technical Relays**. They do not possess the ability to modify transaction destination addresses or intercept funds, as all payloads are cryptographically signed within the user's Enclave before transmission. They serve to ensure uptime, privacy (by masking user IPs), and protocol optimization.

### 3.2 Conxian Gateway (B2B)
The Gateway acts as a portal for institutional users to interact with their mobile enclaves.
* **Risk:** Institutional data privacy.
* **Mitigation:** The Gateway never sees private keys. It only facilitates the transmission of unsigned transaction data to the user's device for signing.

---

## 4. Technical Risks

### 4.1 Risk: Enclave Breach / Side-Channel Attack
* **Description:** An attacker bypasses the Android Keystore/TEE protections.
* **Mitigation:**
    * **Memory-Only Handling:** Seed phrases are never written to disk.
    * **Biometric Hardening:** Critical actions require biometric re-authentication at the OS level.
    * **Play Integrity Attestation:** Mandatory for high-value operations to ensure the device environment is uncompromised.

### 4.2 Risk: Third-Party API Failure (Dependency Risk)
* **Description:** Transak, VALR, or Breez services go offline.
* **Mitigation:**
    * **Sovereign Rails:** Deployment of dedicated proxies and nodes (M12) reduces reliance on shared public infrastructure.
    * **Failsafe Mode:** If APIs fail, the wallet defaults to "Basic Mode" (Send/Receive on-chain) which requires no third parties.

---

## 5. Bitcoin Layer Risk Assessment

### 5.1 Stacks (sBTC)
* **Risk Level:** Low (L2) - [BitcoinLayers.org: L2]
* **Risk Warning:** Decentralized, but Novel.
* **Custody Model:** Trust-minimized and decentralized.

### 5.2 Rootstock (RSK) & Liquid (L-BTC)
* **Risk Level:** Medium (Sidechain)
* **Risk Warning:** Federated.
* **Custody Model:** Users trust a federation of functionaries/signers.

### 5.3 RGB Protocol
* **Risk Level:** Low (Client-Side Validated)
* **Risk Warning:** Data Availability Risk.
* **Custody Model:** Truly non-custodial. Assets live in Taproot commitments.

### 5.4 WabiSabi (CoinJoin)
* **Risk Level:** Low (Privacy Protocol)
* **Risk Warning:** Coordinator Reliability.
* **Custody Model:** Non-custodial. Users retain control throughout the mixing process.

### 5.5 Musig2 (Taproot Multi-Sig)
* **Risk Level:** Low (Cryptographic Standard)
* **Risk Warning:** Key Management.
* **Custody Model:** Enhances sovereignty by allowing institutional quorums without a single point of failure.

### 5.6 BitVM, Ark, State Chains, Maven
* **Risk Level:** Experimental / Medium.
* **Note:** See IMPLEMENTATION_REGISTRY.md for current status.

---

*Maintained by: Conxian Labs Legal & Compliance Team*
