---
title: Business State
layout: page
permalink: /business
---

**Last Updated:** 2026-02-11

## Market Fit

**Status:** [DEFINED] — See `docs/COMPETITIVE_ANALYSIS.md` and `docs/PRODUCT_STRATEGY.md`

- **Target Persona:** Security-conscious Bitcoin enthusiasts and power users seeking multi-layer sovereignty.
- **Conclave Gap:** Hardware-level security (TEE) without a physical dongle — unique position between hardware wallets (Ledger/Trezor) and software wallets (MetaMask/Xverse).
- **Differentiators:** Multi-chain Bitcoin L1/L2 unification, gas abstraction, privacy scoring, AI-powered UTXO management.
- **Competitive Edge:** Zero-markup bridge integration (Solver Rebates) vs 2-5% spreads on competitors; native Lightning via Breez SDK.

## Risk & Compliance

**Status:** [DOCUMENTED] — See `RISK_REGISTRY.md` and `PARTNERS_AND_COMPLIANCE.md`

- **Regulatory Classification:** Software provider (non-custodial), not a financial intermediary.
- **Key Mitigations:** No fiat handling, no shadow ledgers, partner-delegated regulated flows (Transak, VALR, Changelly).
- **Open Risks:** SEC broker-dealer classification if swap UI implies agency; AML compliance for jurisdictions requiring VASP registration.

## Monetization

**Status:** [DEFINED] — See `MONETIZATION.md`

- **Revenue Streams:** Affiliate commissions (partners), premium subscriptions (AI features), Network Utility Fees (LSP routing, Acceleration), Bridge Solver Rebates, SDK licensing.
- **Prohibited Models:** Direct fiat custody, Money Transmission Fees (adding markup to transfers), data monetization without consent.

## Roadmap

**Status:** [ACTIVE] — See `ROADMAP.md` and `IMPLEMENTATION_REGISTRY.md`

- **Completed Milestones:** M1 (Notifications), M2 (Transaction Lifecycle), M3 (PSBT Correctness), M8 (Privacy Scoring).
- **In Progress:** M5 (NTT Execution — experimental), M9 (Ordinals/Runes — UI drafted).
- **Planned:** M4 (Multi-Wallet), M6 (Multi-Sig), M7 (Privacy v2), M10 (ZK Verifier), M11 (BitVM).
