---
title: Changelog
layout: page
permalink: /changelog
---

# Changelog

All notable changes to the Conxius Wallet project will be documented in this file.

## [Unreleased]

### Added
- **Lightning Resilience Implementation**: Integrated SRL-1, SRL-2, and SRL-7 in the TypeScript layer, adding payment state machines, concurrent execution guards (idempotency), and bounded retry logic for Breez (CON-688).

### Changed
- **Breez Payment Flow Hardening**: Fixed a critical bug in the idempotency implementation where concurrent calls could bypass state transition checks.
- **State Machine Invariants**: Enforced strict monotonic state transitions for Lightning payments to prevent illegal terminal state modifications.

## [1.9.2] - 2026-04-18

### Added
- **Trust-Tier Policy Enforcement**: Implemented executable policy engine in `services/trust-policy.ts` to enforce approved bridge and messaging constraints (T1-T4).
- **Secret Scanning**: Added `.github/workflows/secret-scan.yml` utilizing Gitleaks for automated sensitive data detection.
- **Trust Policy Documentation**: Created canonical matrix in `docs/architecture/APPROVED_BRIDGE_AND_MESSAGING_SYSTEMS_BY_TRUST_TIER.md`.

### Changed
- **NTT Service Hardening**: Updated `NttService.executeNtt` and `getRecommendedBridgeProtocol` to be trust-aware and fail-closed on policy violations.
- **Error Visibility**: Policy guard violations now use the `Guard:` prefix to ensure visibility through the wallet's aggressive error sanitization layer.
- **Production-Truth Alignment**: Release builds now fail closed for the current stubbed `PlayIntegrityPlugin` path until real request + backend verification is wired end-to-end.
- **Production-Truth Alignment**: Simulated `DlcManager` flows are now debug-only and fail closed in release builds until production-backed execution is implemented.

### Fixed
- Ark service simulation strings to match test requirements.
- Standardized BTC balance formatting in Android WalletViewModel.
- Fixed regex statefulness in sanitization functions.

### Security
- Hardened Android .gitignore to protect keystores and private keys.
- Standardized security contact to security@conxian.io.
