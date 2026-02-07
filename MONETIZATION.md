---
title: Monetization Strategy
layout: page
permalink: /monetization
---

# Conxius Monetization Strategy

**Philosophy:** Revenue is generated through **Software Services** and **Affiliate Referrals**, not through management fees or custody of funds.

## 1. Revenue Streams

### 1.1 Affiliate Commissions (The "Referral" Layer)
We earn a referral fee for connecting users to regulated financial services.
* **Fiat On-Ramp:**
    * **Partner:** Transak
    * **Mechanism:** User buys BTC via the Transak widget.
    * **Revenue:** ~0.5% - 1% of transaction volume (Paid by Transak).
* **Token Swaps:**
    * **Partner:** Changelly / SideShift
    * **Mechanism:** User swaps BTC for STX.
    * **Revenue:** ~0.25% - 0.5% of spread (Paid by Partner).

### 1.2 Premium Software Features & Services
* **"Conclave Pro":** A subscription model (SaaS) for advanced power-user features.
    * Multi-sig coordination tools.
    * Advanced UTXO management dashboard.
    * Nostr Relay access (Premium bandwidth).
    * *Note: This is a software license fee, not a financial management fee.*
* **Gas Abstraction Service:**
    * **Mechanism:** A "convenience fee" for simplifying cross-chain transactions.
    * **Implementation:** A 0.1% convenience fee is charged on Wormhole NTT transfers to cover the costs of the Wormhole Relayer and the gas abstraction logic.
    * **User Value:** Pay for cross-chain transactions in a single asset (e.g., sBTC) while the software handles background gas token swaps.

### 1.3 B2B SDK Strategy
The "Conclave" TEE technology is packaged as a B2B SDK for other wallets and applications to integrate.
* **Licensing Model:** A licensing fee is charged for the use of the Conclave SDK.
* **Revenue Share:** A revenue-sharing model may be implemented for applications that use the Conclave SDK to power their own monetization strategies.

## 2. Prohibited Revenue Models (The "Red Lines")
To maintain our "Software Provider" regulatory status, Conxian Labs **strictly prohibits**:
* **x** Taking a percentage of "Assets Under Management" (AUM).
* **x** Charging "Performance Fees" on user portfolios.
* **x** Internal market making or spread capture on user trades.
* **x** Holding user fiat in a Conxian bank account to earn interest.
