---
title: Business State
layout: page
permalink: /docs/state/business
---

# Business State (v1.9.5)

**Context:** B2B Alignment & Mainnet Readiness. COO Alignment (2026-06-30).
**Status:** ALIGNED — Release-baseline hardening in progress; production promotion remains gated.

The wallet-local value-operation boundary is **Implemented — fail-closed
containment; production execution unsupported**. Reviewed App/context/UI,
signing, broadcast, bridge, payment, swap, merchant, and protocol adapter paths
now require exact typed authorization/artifact requests or return typed
rejected, unsupported, or quarantined outcomes before side effects. The
production evidence verifier always returns `unsupported_provider`.

Bitcoin broadcast containment additionally requires genuine signer-issued
PSBT→final-transaction provenance paired with the exact authorization. This is
an in-process anti-forgery boundary, not provider qualification or proof of
submission. The broadcaster remains unsupported, performs no network I/O, and
does not consume a broadcast stage until a future qualified provider is ready
to make an irreversible call.

This is client-process-local containment, not a sellable production capability.
Real-device and provider qualification, backend verification, roots/collateral/
revocation, trusted time, durable distributed replay, provider receipts and
finality, staged rollout, independent security review, and release acceptance
remain open. See the [issue #444 evidence record](../reports/ISSUE_444_VALUE_OPERATION_GATE_CONTAINMENT.md),
the [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md),
and the [Technical Debt Register](../operations/TECHNICAL_DEBT_REGISTER.md).

## 🎯 Market Positioning
- **Target**: High-net-worth individuals, institutional treasuries, and sovereign operators.
- **Offer**: Conxius Wallet (Retail/Pro), Conxian Gateway (Institutional), Conxius Enclave SDK (Developer).

## 💰 Monetization
- **Protocol Fees**: 1% on sBTC and bridge transactions (Revenue Automation).
- **Referral**: 5-5-5 revenue share model for ecosystem growth.
- **Enterprise**: Tiered SaaS and support for Gateway/SDK.

## 🤝 Partnerships
- **Custody**: Non-custodial preference; integration with Safe for institutional limits.
- **Liquidity**: 1inch/LI.FI for cross-chain swaps.
- **Compliance**: Local-first FDC3-compatible institutional workflows.
