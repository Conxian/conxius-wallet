# Sovereign Bridge & Interoperability Strategy

**Date:** 2026-02-10
**Status:** DRAFT
**Context:** Research findings on Wormhole availability and native ethos-aligned bridging mechanisms.

---

## 1. Executive Summary

To maintain our "Sovereign by Design" ethos, Conxius cannot rely on custodial bridges or opaque "wrapped" assets. Our interoperability strategy uses a **Hybrid Model**:

1. **Native Sovereign Pegs** (Primary): Use the canonical, trust-minimized bridge of each layer (sBTC, PowPeg, L-BTC) where possible.
2. **Trustless Atomic Swaps** (Accelerator): Use **Boltz** for fast, non-custodial entry/exit to Liquid and Lightning.
3. **Wormhole NTT** (Inter-Layer): Use Wormhole's **Guardian Network** for message passing, but we must deploy and own the **NTT Contracts**.

---

## 2. Wormhole Service Availability

**The Question:** "Are there any available Wormhole services we can rely on?"

**The Answer:** Yes, but **you are the service provider.**

* **What is Available:** The **Wormhole Guardian Network** (19 validators) is live and public. They *will* attest to your messages if emitted correctly.
* **What is Missing:** There is no "Public Generic Relayer" that automatically knows about your specific Conxius NTT token.
* **Requirement:** We must deploy **Native Token Transfer (NTT)** contracts to our target chains (Ethereum, Arbitrum, Base).
  * **Manager Contract:** Handles mint/burn/lock logic.
  * **Transceiver Contract:** Emits messages to the Guardians.
* **Relayer Strategy:** We cannot rely on the "Standard Relayer" for custom NTT logic without configuration. We should run a lightweight **Specialized Relayer** (serverless function) that observes our NTT events and submits the VAA to the destination chain.

**Ethos Check:**

* ✅ **Trustless:** We verify Guardian signatures on-chain.
* ✅ **Sovereign:** We own the token contracts; Wormhole is just the messenger.

---

## 3. Native Ethos-Aligned Mechanisms

We prioritize mechanisms that derive security from Bitcoin or minimize trust.

### A. Stacks (sBTC)

* **Mechanism:** Decentralized Two-Way Peg (Nakamoto Release).
* **Status:** **LIVE** (Deposits enabled Dec 2024, Withdrawals March 2025).
* **Peg-In (BTC -> sBTC):**
  * User sends BTC to a specific script hash on Bitcoin L1.
  * Stackers (validators) observe the tx and mint sBTC.
* **Ethos Alignment:** ⭐⭐⭐⭐⭐ (Bitcoin-secured, no federation).
* **Action:** Implement `signer.ts` support for the specific sBTC deposit script format.

### B. Rootstock (RBTC)

* **Mechanism:** **PowPeg** (Proof-of-Work Peg).
* **Trust Model:** Federated (PowHSM) but secured by Bitcoin merge-mining.
* **Peg-In (BTC -> RBTC):**
  * User sends BTC to the PowPeg Federation Address.
  * Requires ~100 confirmations (approx. 16 hours) for safety.
* **Ethos Alignment:** ⭐⭐⭐⭐ (Merge-mined security, hardware enforcement).
* **Action:** Use native bridge for large amounts; use Swaps (see below) for speed.

### C. Liquid (L-BTC)

* **Mechanism:** Federated Peg (Liquid Federation).
* **Trust Model:** Federated (15 functionaries).
* **Native Peg-In:** Slow (102 confirmations required).
* **Ethos Alignment:** ⭐⭐⭐ (Federated, but supports Confidential Transactions).
* **Alternative:** **Boltz Submarine Swaps**.

---

## 4. The "Boltz" Accelerator (Recommended)

Native pegs (Liquid, RSK) are often slow (100+ confirmations).
To solve UX without sacrificing sovereignty, we should integrate **Boltz**.

* **What is it?** A non-custodial exchange for Submarine Swaps (Atomic Swaps).
* **Supported Pairs:**
  * Bitcoin (L1) <-> Lightning
  * Bitcoin (L1) <-> Liquid (L-BTC)
* **How it works:**
  * Uses **HTLCs** (Hash Time-Locked Contracts).
  * "If you send me BTC, I reveal the secret to claim L-BTC."
  * If the swap fails, the user **refunds themselves** via their local key.
* **Why use it:**
  * **Speed:** Instant vs 16 hours.
  * **Ethos:** Trustless. If Boltz disappears, funds are not lost.
* **Action:** Integrate Boltz API for Liquid and Lightning "Fast Path".

---

## 5. Strategic Roadmap Update

| Layer | Primary Method (Large Value) | Fast Method (Daily Use) | Infra Required |
|-------|------------------------------|-------------------------|----------------|
| **Stacks** | **sBTC Native Peg** | N/A (Waiting for Bitflow/Alex) | Bitcoin Node (Index) |
| **Liquid** | **Boltz Atomic Swap** | **Boltz Atomic Swap** | Boltz API Client |
| **RSK** | **PowPeg** | Sovryn FastBTC | None (Direct Contract) |
| **EVM** | **Wormhole Token Bridge** | Wormhole Token Bridge | Standard Portal Contracts |

**Next Step:**

1.  **Refactor `ntt.ts`** to use Standard Token Bridge SDK.
2.  **Integrate Boltz SDK** (to unlock Liquid/Lightning).
3.  **Implement sBTC Scripting** (to unlock Stacks).
