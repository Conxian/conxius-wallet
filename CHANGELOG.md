---
title: Changelog
layout: page
permalink: /changelog
---

# Changelog

All notable changes to the Conxius Wallet project will be documented in this file.

## [Unreleased]

### Added
- **Trust-Tier Policy Enforcement**: Implemented executable policy engine in `services/trust-policy.ts` to enforce approved bridge and messaging constraints (T1-T4).
- **Secret Scanning**: Added `.github/workflows/secret-scan.yml` utilizing Gitleaks for automated sensitive data detection.
- **Trust Policy Documentation**: Created canonical matrix in `docs/architecture/APPROVED_BRIDGE_AND_MESSAGING_SYSTEMS_BY_TRUST_TIER.md`.

### Changed
- **NTT Service Hardening**: Updated `NttService.executeNtt` and `getRecommendedBridgeProtocol` to be trust-aware and fail-closed on policy violations.
- **Error Visibility**: Policy guard violations now use the `Guard:` prefix to ensure visibility through the wallet's aggressive error sanitization layer.
- **Production-Truth Alignment**: Release builds now fail closed for the current stubbed `PlayIntegrityPlugin` path until real request + backend verification is wired end-to-end.
- **Production-Truth Alignment**: Simulated `DlcManager` flows are now debug-only and fail closed in release builds until production-backed execution is implemented.

### Documentation
- Clarified readiness language so implemented, simulated, and production-enforced states are not conflated.

## [1.9.2] - 2026-04-18
