---
title: Conxius Wallet README
layout: page
permalink: /
---

# Conxius Wallet: The Sovereign Bitcoin Command Center (v1.6.0)

Conxius is a non-custodial, "Sovereign-First" financial command center for the full Bitcoin ecosystem. It bridges the security of a hardware-isolated environment (Android StrongBox/TEE) with the utility of modern DeFi, cross-chain interoperability, and real-world services.

## 🚀 Key Pillars

- **Zero-Leak Privacy**: Mandatory local redaction of PII and sensitive identifiers before any AI or network transmission.
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
- **cxn-arch-guardian AI**: Local privacy filter and intent detector enforcing Zero Secret Egress.

## 🧪 Development

```bash
pnpm install
pnpm run dev
pnpm test
```

---
*Powered by the Conxius Enclave Protocol. Sovereignty by Design. Aligned to Phase 5 "Clean Break".*
