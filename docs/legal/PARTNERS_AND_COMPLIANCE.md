---
title: Partners & Compliance
layout: page
permalink: /partners
---

# Approved Partners & Compliance Stack

**Objective:** Enable financial features by integrating regulated third-party APIs.

## 1. Fiat On-Ramps (Buying Crypto)
* **Provider:** **Transak**
* **Status:** APPROVED
* **Compliance Role:** Acts as the Merchant of Record. Handles KYC (FICA), Fraud Checks, and Chargebacks.
* **Integration:** Android SDK.
* **Link:** `https://docs.transak.com/`

## 2. South African Banking Bridge (ZAR)
* **Provider:** **VALR**
* **Status:** APPROVED STRATEGIC PARTNER
* **Compliance Role:** Licensed SA Financial Services Provider (FSP). Holds user ZAR custody.
* **Integration:** VALR Pay API (OAuth).
* **Feature:** "Connect VALR Account" (Allows users to push/pull ZAR from their own VALR wallet).
* **Link:** `https://docs.valr.com/`

## 3. Asset Swaps (BTC <-> STX)
* **Provider:** **Changelly**
* **Status:** APPROVED
* **Compliance Role:** Counterparty for all trades. Handles AML screening on destination addresses.
* **Integration:** REST API (Floating Rate).
* **Link:** `https://changelly.com/developers`

## 4. Lightning Network (LSP)
* **Provider:** **Breez (Greenlight)**
* **Status:** APPROVED
* **Compliance Role:** Technology provider. Node runs in cloud, keys stay in Conclave.
* **Integration:** Breez SDK.
* **Note:** We do NOT act as the routing node (LSP) to avoid Money Transmitter licensing.

## 5. Developer Rules of Engagement
1.  **Never Touch Fiat:** Do not build any feature that accepts card payments directly to our bank account.
2.  **No Shadow Ledgers:** Never record a user's balance in our own database. Always fetch balances live from the blockchain or the Partner API.
3.  **UI Labeling:** When a user enters a regulated flow (e.g., Buying BTC), display a toast/banner: *"Powered by Transak. You are leaving Conxius to complete this transaction."*
