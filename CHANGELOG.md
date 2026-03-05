---
title: Changelog
layout: page
permalink: /changelog
---

# Changelog

All notable changes to the Conxius Wallet project will be documented in this file.

## [1.6.0] - 2026-02-18

### Added
- **Babylon Staking Integration**: Full non-custodial Bitcoin staking support via P2P.org API for transaction construction.
- **NIP-47 (Nostr Wallet Connect)**: Support for KIND 23124/23125 to allow remote wallet control from external Nostr apps (e.g., Damus).
- **DLC (Discreet Log Contracts)**: Service for conditional on-chain payments based on oracle attestations (DLC.link alignment).
- **Unified Yield Infrastructure**: Integration with Yield.xyz to access 70+ yield protocols with hardware-signed payloads.
- **Advanced Liquidity Hub**: Added 1inch and LI.FI aggregators for optimal swap routing and cross-chain bridging.
- **Parametric Insurance**: Integrated Neptune Mutual and InsurAce for decentralized smart contract and bridge coverage.
- **Sovereign Marketplace Expansion**: New real-world utilities including Travala (Travel), Satlantis (Ticketing), and Silent.Link (Ghost eSIMs).
- **B2B Payment Gateway**: CoinsPaid integration for turnkey merchant invoice generation directly into the enclave.

### Improved
- **Monetization Engine**: Implemented specific routing fees and affiliate commission logic for all integrated services.
- **UI Navigation**: Refined Sidebar and DeFiDashboard to accommodate the expanded service matrix.
- **Security Posture**: Enforced localized signing and payload isolation for all new third-party integrations.

## [1.5.0] - 2026-02-18
... (previous entries)

## [1.5.1] - 2026-03-05
### Enhanced
- Refactored NTT support to use official @wormhole-foundation/sdk v4+ abstractions.
- Implemented dynamic public NTT asset discovery via Wormholescan API.
- Enhanced NTTBridge UI with real-time Guardian attestation tracking (X/19 signatures).
- Aligned ConxiusWormholeSigner with standard SDK interfaces for multi-chain support (Ethereum, Base, Arbitrum, Stacks).
- Integrated sBTC public NTT placeholders for mainnet readiness.
