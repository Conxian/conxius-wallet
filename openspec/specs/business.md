---
title: Business
layout: page
permalink: /./openspec/specs/business
---

# Business Specification (v1.9.5)

## Vision
Conxius Wallet: The Ultimate Multi-Chain Sovereign Interface for the Full Bitcoin Ecosystem. "The Citadel in your pocket."

## Monetization (Protocol-Level)
- **Routing Fees**: Lightning and Liquid routing.
- **Service Fees**: Swaps (Boltz, Changelly) and Bridge execution (Wormhole).
- **Gas Abstraction**: Small premiums on destination gas coverage.
- **B2B SaaS**: Subscription-based institutional tools via Conxian Gateway.

## Strategic Pillars
- **Sovereign Handshake**: One authorization for multi-step cross-chain flows.
- **Zero Secret Egress**: Private key material remains inside Android Keystore-backed boundaries; StrongBox is required only for policies with explicit StrongBox evidence, and existing AES storage may use a TEE fallback.
- **Citadel Native**: Pure Kotlin/Rust architecture (Phase 4).
- **Global Sovereignty**: Institutional quorums via Taproot Musig2.

KeyMint evidence and Play Integrity token acquisition are client-side
authorization inputs, not proof that protocol signing is hardware-qualified or
that a value operation has been authorized. See the [CON-1544 qualification report](../../docs/reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md).
