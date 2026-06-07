---
title: Changelog
layout: page
permalink: /changelog
---

# Changelog

All notable changes to the Conxius Wallet project will be documented in this file.

## [Unreleased]

### Changed
- **Production-Truth Alignment**: Release builds now fail closed for the current stubbed `PlayIntegrityPlugin` path until real request + backend verification is wired end-to-end.
- **Production-Truth Alignment**: Simulated `DlcManager` flows are now debug-only and fail closed in release builds until production-backed execution is implemented.

### Documentation
- Clarified readiness language so implemented, simulated, and production-enforced states are not conflated.

## [1.9.2] - 2026-04-18

### Added
- **Full Ecosystem Native Bridge**: Implemented native Kotlin managers for all supported protocols:
  - `BdkManager` (Bitcoin L1)
  - `BabylonManager` (BTC Staking)
  - `NwcManager` (Nostr Wallet Connect)
  - `DlcManager` (Discreet Log Contracts)
  - `ArkManager` (Ark VTXO Management)
  - `StateChainManager` (Key Rotation)
  - `MavenManager` (AI Marketplace)
  - `LiquidManager` (Confidential Assets)
  - `EvmManager` (BOB/Rootstock/B2)
  - `StacksManager` (Stacks/sBTC)
  - `RgbManager` (Client-Side Validation)
  - `BitVmManager` (Fraud Proofs)
  - `Web5Manager` (DIDs/DWNs)
- **Bridged Sovereign Architecture**: Transitioned logic to a hybrid model where security-critical signing resides in the native enclave while protocol logic is managed in TypeScript.
- **Enhanced Security**: Integrated `PlayIntegrityPlugin` bridge for Play Integrity attestation workflows.
- **Institutional ERP Integration**: Implemented OData v4 translation layer and X402 Mandate mapping in the Conxian Gateway for SAP/Oracle synchronization (CON-63).

### Improved
- **Unified Protocol Fetching**: Aligned `services/protocol.ts` with the full v1.9.2 asset hierarchy.
- **Dependency Injection**: Refactored `ViewModelFactory` and `MainActivity` to support the expanded native manager suite.
- **Memory Hardening**: Verified 'Zero Secret Egress' patterns across all new native modules.

### Documentation
- Updated `docs/business/PRD.md`, `docs/protocols/IMPLEMENTATION_REGISTRY.md`, `AGENTS.md`, and `docs/archive/PROJECT_CONTEXT.md` to reflect the v1.9.2 state.
- Normalized all version references to 1.9.2 across the repository.

## [1.5.0] - 2026-02-18
... (previous entries)
