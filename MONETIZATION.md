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

#### Fiat On-Ramp

* **Partner:** Transak
* **Mechanism:** User buys BTC via the Transak widget.
* **Revenue:** ~0.5% - 1% of transaction volume (Paid by Transak).

#### Token Swaps (Enhanced Revenue Share)

* **Partner:** Changelly / THORChain
* **Mechanism:** User swaps BTC for STX via integrated swap interface.
* **Revenue:**
  * **Changelly:** 50/50 revenue share on all swap fees (0.25-0.5% split)
  * **THORChain:** Affiliate fee basis points on every swap
  * **Duration:** 90-day cookie window for Changelly
* **Why it scales:** Every swap user makes generates recurring passive income.

#### "Sovereign Shield" Shop - Hardware Wallet Affiliate 🛡️

* **Partners:** Ledger, Trezor, BitBox
* **Mechanism:** Recommended hardware wallets section in app settings
* **Commission Structure:**
  * Ledger: 10-12% commission
  * Trezor: Up to 15% commission (tiered structure)
  * BitBox: Competitive hardware wallet rates
* **Alignment:** Perfectly aligns with "Sovereign by Design" philosophy
* **User Journey:** Users value security → upgrade to hardware → you earn commission

#### "Live on Crypto" Mode - Bitrefill Integration 🛒

* **Partner:** Bitrefill (Global gift card & voucher platform)
* **Mechanism:**
  * In-app "Spend" section linking to Bitrefill catalog
  * Widget integration for seamless experience
  * Support for Checkers, Takealot, airtime (South Africa focus)
* **Revenue:** 1% commission on every purchase, instantly
* **Catalog:** 7,000+ products across 186 countries
* **Payment Methods:** BTC, Lightning, USDT, ETH, LTC, DOGE, DASH
* **Why it fits:** Transforms Conxius from "holding" wallet to "living" wallet

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
