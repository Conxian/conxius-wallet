---
title: Risk Registry
layout: page
permalink: /risk
---

# Conxius Wallet Risk & Compliance Registry

**Last Updated:** 2026-02-06
**Entity:** Conxian Labs
**Jurisdiction:** South Africa (Primary), Global (Secondary)

## 1. Executive Summary
Conxius Wallet is a strictly non-custodial software interface ("The Tool"). It leverages a Trusted Execution Environment (TEE) known as "The Conclave" to ensure Conxian Labs never possesses, manages, or controls user funds. All financial services (Fiat On-Ramps, Swaps) are offloaded to regulated third-party providers.

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
    * **No Fiat Touchpoints:** Conxian-Labs bank accounts never touch user funds.

### 2.3 Risk: US Securities Laws (SEC)
* **Description:** Risk of being deemed an unregistered Broker-Dealer for facilitating swaps.
* **Mitigation:**
    * **Direct Routing:** Swap features utilize the **Changelly API** or Decentralized Atomic Swaps. Conxius does not match orders or hold inventory.
    * **UI-Only Role:** The Terms of Service explicitly define the app as a "Self-Hosted Wallet Interface."

---

## 3. Technical Risks

### 3.1 Risk: Enclave Breach / Side-Channel Attack
* **Description:** An attacker bypasses the Android Keystore/TEE protections.
* **Mitigation:**
    * **Memory-Only Handling:** Seed phrases are never written to disk.
    * **Biometric Hardening:** Critical actions require biometric re-authentication at the OS level.

### 3.2 Risk: Third-Party API Failure (Dependency Risk)
* **Description:** Transak, VALR, or Breez services go offline.
* **Mitigation:**
    * **Failsafe Mode:** If APIs fail, the wallet defaults to "Basic Mode" (Send/Receive on-chain) which requires no third parties.
    * **Vendor Diversity:** Architecture allows hot-swapping providers (e.g., switching Transak to MoonPay) via remote config.

---

## 4. Bitcoin Layer Risk Assessment

This section outlines the risk profiles of the Bitcoin L2s and Sidechains supported by the Conxius Wallet.

### 4.1 Stacks (sBTC)
* **Risk Level:** Low (L2) - [BitcoinLayers.org: L2]
* **Risk Warning:** Decentralized, but Novel.
* **Custody Model:** The sBTC peg is designed to be trust-minimized and decentralized. However, the system's security relies on a novel consensus mechanism (Proof-of-Transfer) and the economic incentives of STX miners.
* **Key Consideration:** While not custodial in the traditional sense, users should be aware that the security of their assets is tied to the Stacks network's consensus and the correct functioning of the sBTC protocol.

### 4.2 Rootstock (RSK)
* **Risk Level:** Medium (Sidechain) - [BitcoinLayers.org: Sidechain]
* **Risk Warning:** Federated.
* **Custody Model:** Rootstock uses a merge-mined model, which provides a high degree of security. However, the two-way peg (PowPeg) is managed by a federation of well-known blockchain companies.
* **Key Consideration:** Users are trusting this federation (the PowPeg federation) to act honestly and competently in managing the peg.

### 4.3 Liquid Network (L-BTC)
* **Risk Level:** Medium (Sidechain) - [BitcoinLayers.org: Sidechain]
* **Risk Warning:** Federated.
* **Custody Model:** The Liquid Network is a sidechain with a federated model. A group of "functionaries" (trusted parties) are responsible for managing the two-way peg.
* **Key Consideration:** This is a custodial model where users are trusting the federation of functionaries to secure their assets.

### 4.4 BOB (Build On Bitcoin)
* **Risk Level:** Medium (EVM L2) - [BitcoinLayers.org: L2 - Optimistic/Federated]
* **Risk Warning:** Federated/EVM Risk.
* **Custody Model:** BOB is an EVM-compatible L2 that uses a multi-sig bridge. While it aims for BitVM-based security, current phases involve federated controls.
* **Key Consideration:** Users are exposed to EVM smart contract risks and the honesty of the bridge federation.

### 4.5 Ark Protocol (VTXOs)
* **Risk Level:** Low (L2 - Off-chain)
* **Risk Warning:** Service Dependency.
* **Custody Model:** Funds are held in shared UTXOs (VTXOs). Users have unilateral exit rights to L1, but daily off-chain transactions depend on an Ark Service Provider (ASP).
* **Key Consideration:** If the ASP goes offline, users must wait for the exit timeout to reclaim funds on L1.

### 4.6 RGB Protocol
* **Risk Level:** Low (Client-Side Validated)
* **Risk Warning:** Data Availability Risk.
* **Custody Model:** Truly non-custodial. Assets live in Taproot commitments.
* **Key Consideration:** Users are responsible for their own consignment data. If data is lost, the asset cannot be proven/transferred. Conxius mitigates this via encrypted cloud backups of consignments.

### 4.7 State Chains
* **Risk Level:** Medium (Off-chain UTXO)
* **Risk Warning:** Federated Trust.
* **Custody Model:** Uses a 2-of-2 multi-sig between the user and a State Chain Entity (SCE).
* **Key Consideration:** The SCE cannot steal funds alone, but they can collude with a previous owner or refuse to sign, requiring an L1 exit.

### 4.8 BitVM & Maven
* **Risk Level:** Experimental.
* **Risk Warning:** Technical Complexity.
* **Custody Model:** Purely cryptographic/mathematical security.
* **Key Consideration:** These protocols are in early stages; unintended bugs in the verifier logic could lead to loss of funds.
