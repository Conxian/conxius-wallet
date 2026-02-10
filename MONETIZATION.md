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

#### "Sovereign Shield" Shop (Hardware Affiliates) 🛡️

**Verdict:** **Lowest Effort / High Trust**
Curated security recommendation list. We do not sell hardware; we recommend the best tools for sovereignty.

* **BitBox02 (Best Fit):**
  * **Why:** Swiss-made, open-source firmware, Bitcoin-only friendly.
  * **Revenue:** **12% commission** (Paid in Bitcoin).
  * **Integration:** Direct "Buy BitBox02" link in Security section.
* **Trezor:**
  * **Why:** The OG hardware wallet. High brand recognition.
  * **Revenue:** **12-15% commission**.
* **Ledger:**
  * **Why:** Market volume leader.
  * **Revenue:** **10% commission**.

#### "Live on Crypto" Mode (Bitrefill Integration) 🛒

**Verdict:** **High Utility / Recurring Revenue**
Turns Conxius into a daily driver for South African users.

* **The Hook:** Buy Checkers, Takealot, Mr D, Uber, and Airtime with Bitcoin/Lightning.
* **Revenue:** **1% of total volume** forever (Passive).
* **Integration:** "Spend" tab/button in Dashboard opening `bitrefill.com/?ref=[YourID]`.

#### Sovereign Swaps (Changelly & THORChain) 🔄

**Verdict:** **Highest Potential / Native Feel**

* **Option A: Changelly (The Easy Route)**
  * **How:** API integration.
  * **Revenue:** 50% revenue share of their 0.5% fee (0.25% total).
  * **Pros:** Broad token support.
  * **Cons:** Potential KYC.

* **Option B: THORChain (The Sovereign Route - Priority)**
  * **How:** Native L1 swaps (BTC -> ETH/Stables).
  * **The "Memo" Trick:** Append `:conxius:50` to the swap memo.
  * **Revenue:** **50 basis points (0.5%)** programmatic on-chain revenue.
  * **Requirement:** Register "conxius" name on THORChain.

### 1.2 Premium Software Features & Services

* **"Conclave Pro":** A subscription model (SaaS) for advanced power-user features.
  * Multi-sig coordination tools.
  * Advanced UTXO management dashboard.
  * Nostr Relay access (Premium bandwidth).
  * *Note: This is a software license fee, not a financial management fee.*
* **Gas Abstraction Service:**
  * **Mechanism:** A "convenience fee" for simplifying cross-chain transactions.

### 1.3 The Sovereign Bridge (Revenue Option 3) 🌉

**Concept:** A "Hidden Rail" that allows users to exit the altcoin casino and enter Bitcoin sovereignty without leaving the app.
**Mechanism:** Users deposit ETH/EVM assets into a generated "Bridge Portal" address. The system offers an immediate "Purify" option to swap to BTC or STX.

#### Vampire Incentives (The "Purification" Strategy) 🧛
How we naturally incentivize users to move assets to Conxius:

1.  **The "Purification" Score:**
    *   **Hook:** "Your portfolio is 40% unsecured (ETH). Purify it to boost your Sovereign Score."
    *   **Reward:** +50 Sovereignty Points for every 0.1 BTC swapped from Alts.
2.  **The Yield Flip (Greed + Ethos):**
    *   **Hook:** Show a live comparison: "ETH Staking (3%) vs Stacks PoX (8% + BTC Appreciation)."
    *   **Action:** One-click "Zap" from ETH Wallet -> Stacking Pool.
3.  **The "Dust Sweeper":**
    *   **Hook:** "You have $14 in scattered shitcoins. Sweep to Sats?"
    *   **Revenue:** We take a slightly higher spread on dust sweeps due to complexity, user gets clean sats.

## 2. Implementation Roadmap
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
