---
title: Conxius Wallet README
layout: page
permalink: /
---

# Conxius Wallet: The Sovereign Bitcoin Command Center (v1.6.0)

![CI](https://github.com/Conxian/conxius-wallet/actions/workflows/ci.yml/badge.svg) ![Security](https://img.shields.io/badge/Security-CXN%20Guardian-orange)

Conxius is a non-custodial, "Sovereign-First" financial command center for the full Bitcoin ecosystem. Powered by the **CXN Guardian** security architecture, it bridges the security of a hardware-isolated environment (Android StrongBox/TEE) with the utility of modern DeFi, cross-chain interoperability, and real-world services.

## Purpose

Provide a non-custodial mobile wallet that unifies Bitcoin-native rails, Stacks, and emerging L2 ecosystems behind hardware-isolated signing and privacy-first defaults.

## Status

**Production (v1.6.0)**. The architecture and supported integrations are aligned with the Phase 5 "Clean Break" migration to pure native Android infrastructure.

## Ownership

Ownership and review requirements are defined in the repository CODEOWNERS file:
https://github.com/Conxian/conxius-wallet/blob/main/.github/CODEOWNERS

## Audience

- End users seeking a sovereignty-first, non-custodial wallet.
- Mobile and security engineers working on enclave-backed key management.
- Protocol and integration developers connecting wallet flows to the Conxian Gateway and on-chain services.

## Relationship to the Conxian stack

- **Client interface** for interacting with the Conxian protocol and broader Bitcoin-layer integrations.
- **CXN Guardian AI**: Integrated privacy layer enforcing Zero Secret Egress for all interactions.
- **Conxian Gateway**: Consumes Gateway APIs for state, compliance, and multi-layer coordination.


## 📦 Release Discipline

Conxius Wallet follows a strict release flow:
- **Versioning**: Semantic Versioning (SemVer) is enforced.
- **Tags**: Production releases are tagged (e.g., \`v1.6.0\`).
- **Changelog**: Every release requires an entry in \`CHANGELOG.md\`.
- **Promotion**: Changes flow from \`dev\` -> \`staged\` -> \`main\`. Promotion to \`main\` requires COO approval and successful E2E validation.

## 🚀 Key Pillars

- **Zero-Leak Privacy**: Mandatory local redaction of PII and sensitive identifiers via CXN Guardian before any AI or network transmission.
- **Hardware-Isolated Signing**: Cryptographic keys never leave the mobile device's Secure Enclave (StrongBox).
- **Full Stack Bitcoin**: Native support for L1 (Segwit/Taproot), Lightning (Breez), Stacks (sBTC), Liquid (L-BTC), Rootstock, and 14+ Bitcoin L2s.
- **Advanced Protocols**: Integrated support for Babylon Staking, Discreet Log Contracts (DLCs), and Nostr Wallet Connect (NIP-47).

## 🛠️ Integrated Services (Non-Custodial)

- **Unified Yield**: Access staking and lending via Yield.xyz (Lido, Aave, Stader) across 70+ networks.
- **Liquidity Swaps**: Aggregated swaps and bridging via 1inch and LI.FI.
- **Parametric Insurance**: On-chain protection against protocol hacks via Neptune Mutual and InsurAce.
- **Sovereign Marketplace**: Purchase Ghost eSIMs (Silent.Link), Travel (Travala), and Event Tickets (Satlantis) via Lightning.
- **B2B Gateway**: Turnkey merchant payment processing via CoinsPaid integration.

## 🏗️ Technical Architecture

- **Mobile Enclave**: Native Kotlin implementation of TEE-backed AES and RSA providers.
- **Persistent Crypto Worker**: Background TypeScript environment for secure, session-level state management.
- **Sovereign-First RPC**: Prioritizes user-defined custom nodes (Bitcoin Core, Stacks, etc.) over public infrastructure.
- **CXN Guardian AI**: Local privacy filter and intent detector enforcing Zero Secret Egress.

## 🧪 Development

```bash
pnpm install
pnpm run dev
pnpm test
pnpm run test:e2e
```

---
*Powered by the Conxius Enclave Protocol. Sovereignty by Design. Aligned to Phase 5 "Clean Break".*
