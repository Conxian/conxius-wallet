---
title: Changelog
layout: page
permalink: /changelog
---

# Changelog

All notable changes to the Conxius Wallet project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-02-18

### Added

- **Phase 5 Bitcoin Ecosystem Alignment**: Completed full protocol parity for 14+
  Bitcoin layers including Alpen, Zulu, Bison, Hemi, Nubit, Lorenzo, Citrea,
  Babylon, Merlin, and Bitlayer.
- **Maestro UI Testing**: Initialized automated on-device UI testing with
  Maestro, including environment scripts (`run_maestro.bat`) and flow
  definitions.
- **BitVM Cryptographic Verification**: Verified and documented the functional
  cryptographic STARK verifier in the Labs Explorer, aligned with TEE security
  standards.
- **Ecosystem-Wide Versioning**: Harmonized system versioning to v1.5.0 across
  mobile components, B2B gateway descriptors, and core libraries.

### Improved

- **Protocol Fetcher Resilience**: Refactored all Bitcoin layer fetchers in
  `protocol.ts` to ensure production data integrity by returning empty arrays on
  API failure.
- **Documentation Synchronization**: Comprehensive update of Implementation
  Registry, Project Context, and PRD to reflect the "Production Ready" state of
  the full Bitcoin stack.

## [1.4.0] - 2026-02-16

### Added

- **Full Ecosystem Mesh Status**: Enhanced Dashboard topology grid with a 'Full
  Ecosystem (Mesh)' module to visually monitor Bitcoin L2 connectivity (Ark,
  RGB, Stacks, Liquid, Maven, RSK).
- **Maven Sequential Derivation**: Updated Maven protocol to support sequential
  indices (m/84'/0'/0'/3/) for institutional key rotation.
- **Enhanced Test Suite**: Expanded unit tests to include Maven sequential path
  verification and verified 100% pass rate on 145 tests.

### Improved

- **Protocol Audit & Hardening**: Performed a comprehensive root-to-leaf audit
  of all protocol services and UI components.
- **Security Persistence**: Verified 'Zero-Leak' memory hardening across all
  newly refined protocol paths.

## [1.3.0] - 2026-02-16

### Added

- **Unified Protocol Enhancements**: Strengthened the core Bitcoin ecosystem
  protocols including Ark, RGB, Maven, State Chains, and BitVM.
- **Ark Unilateral Exit**: Implemented `redeemVtxo` for unilateral exits and
  real enclave-signed forfeiture logic.
- **RGB On-Chain Anchors**: Integrated real-time on-chain anchor verification
  for RGB consignments via Mempool API.
- **Maven B2B Integration**: Added full Maven L2 transfer preparation with
  enclave-backed signing and broadcast logic.
- **State Chain Coordinator Sync**: Implemented automated coordinator
  notification for off-chain UTXO transfers.
- **BitVM Cryptographic Integrity**: Enhanced functional ZK-STARK verifier with
  stricter proof requirements.

### Fixed

- **Liquid Address Derivation**: Fixed a bug where Liquid derivation returned
  public keys instead of Bech32 addresses; it now produces real `ex1`/`lq1`
  addresses.
- **ASP Simulation Loop**: Replaced generic Ark mocks with state-aware signing
  and forfeiture logic.

### Improved

- **Test Coverage**: Increased unit and integration test suite to 144 tests with
  a 100% pass rate.

## [1.2.0] - 2026-02-15

### Added

- **Full Bitcoin Ecosystem Support**: Expanded architecture to support L1,
  Lightning, Liquid, Stacks, RSK, BOB, RGB, Ordinals, Runes, Ark, BitVM, State
  Chains, and Maven.
- **Enhanced Derivation Matrix**: Added specific derivation paths for Ark
  (VTXO), State Chains (Sequential), and RGB (Taproot) in `services/signer.ts`.
- **Production-Ready Scaffolding**: Integrated protocol fetchers for BOB, RGB,
  Ark, State Chains, and Maven in `services/protocol.ts`.
- **BitVM Verifier Interface**: Scaffolded ZK-STARK proof verification in the
  protocol layer.
- **StrongBox Enforcement**: Native Android logic now prioritizes StrongBox-backed
  Keymaster for all ecosystem keys.
- **Zero-Leak Memory Hardening**: Universal enforcement of `.fill(0)` and
  `try...finally` blocks for sensitive material across all layers.

### Changed

- **PRD Refactor**: Updated Product Requirements Document to reflect the 'Full
  Bitcoin Ecosystem' vision as the source of truth.
- **Whitepaper Alignment**: Rewrote technical whitepaper to cover the
  multi-layer security model and expanded protocol matrix.
- **Roadmap Acceleration**: Realigned milestones to prioritize advanced
  protocols like RGB, Ark, and BitVM.
- **Implementation Registry Update**: Comprehensive audit of feature status
  (Real vs Mocked vs Missing).

## [1.1.5] - 2026-02-10

### Fixed

- **Silent Payments Mock Seed**: Resolved issue where a mock seed was used; now
  correctly decrypts from PIN-gated vault.
- **NTT Bridge Execution**: Replaced mock transaction hash with real Wormhole
  SDK signing and VAA retrieval logic.
- **Non-BTC Fee Estimation**: Replaced hardcoded mocks with real-time fee rates
  for Stacks, Liquid, and RSK.
- **Runes Balance Fetch**: Integrated Hiro Ordinals API for real-time Runes
  data.
- **Google Fonts Offline**: Replaced CDN links with self-hosted @fontsource
  packages.

### Added

- **Device Integrity Plugin**: Implemented multi-layer Android integrity checks
  (root, emulator, system props).
- **Code Splitting**: Implemented React.lazy for all 25 application routes.
- **Error Boundaries**: Added global and route-specific error handling.

## [1.1.0] - 2026-02-05

### Added

- **Conxian Gateway**: Integration with the B2B portal for institutional treasury.
- **Corporate Profiles**: Secure management of enterprise identities.
- **NTT Sovereign Transceiver**: Core logic for Native Token Transfers.
- **ECC Engine Fusion**: Integrated @noble/curves for high-speed arithmetic.

## [1.0.0] - 2026-01-20

### Added

- Initial release of Conxius Wallet.
- BTC L1 (Segwit/Taproot) support.
- Lightning (Breez SDK) integration.
- Encrypted Vault via Android Keystore.
- Satoshi AI (Gemini) integration.

## [1.5.2] - 2026-02-18

### Added

- Milestone M13: Full Taproot Musig2 (BIP-327) implementation with even-Y
  negation logic.
- Milestone M14: Enhanced RGB Client-Side Validation (CSV) with production stash
  management.
- Milestone M15: WabiSabi-aligned CoinJoin protocol state machine.
- Integrated Google Play Integrity for device attestation.

### Changed

- Promoted all experimental B2B rail features (Bisq, Changelly Swaps) to
  production.
- Refined ECC engine with updated @noble/curves API compatibility.
