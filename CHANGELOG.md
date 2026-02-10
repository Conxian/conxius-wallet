---
title: Changelog
layout: page
permalink: /changelog
---

# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project aims to follow Semantic Versioning.

## [Unreleased]

### Added

- **Implementation Registry** (`IMPLEMENTATION_REGISTRY.md`): Authoritative document tracking real vs mocked vs missing features across all services, components, and PRD requirements.
- **Experimental Feature Gating**: `NTT_EXPERIMENTAL`, `SWAP_EXPERIMENTAL` flags with console warnings on mocked services (`ntt.ts`, `swap.ts`).
- **Self-hosted Fonts**: Replaced Google Fonts CDN with `@fontsource/inter` and `@fontsource/jetbrains-mono` npm packages for offline-first compliance.
- **Privacy Scoring Engine**: Dynamic privacy risk assessment based on script types (Taproot), network status (Tor), and UTXO analysis.
- **Physical Backup Audit**: PIN-gated manual verification flow for mnemonic backups against the Secure Enclave.
- **Satoshi AI Privacy Scout**: Context-aware AI assistant that provides proactive privacy and UTXO management advice.
- **Privacy Enclave UI**: Real-time visualization of sovereignty metrics and security recommendations.

### Fixed

- **signer.ts**: Removed dead `seed` variable reference in two `finally` blocks that would cause `ReferenceError` at runtime.
- **signer.ts**: Fixed STX address derivation on native path — now uses `getAddressFromPublicKey` instead of returning placeholder `"SP..."`.
- **protocol.ts**: `fetchStacksBalances` now fetches real-time STX price via `fetchStxPrice()` instead of hardcoded `$2.45`.
- **protocol.ts**: Fixed CoinGecko API ID from `blockstack` (deprecated) to `stacks` in `fetchStxPrice()`.
- **protocol.ts**: Liquid peg-in address now throws explicit experimental error instead of returning fake pi-digit address (fund loss prevention).
- **biometric.ts**: Eliminated double `registerPlugin('SecureEnclave')` — now imports shared instance from `enclave-storage.ts`.
- Improved Satoshi AI system prompt for better integration with on-device wallet state.
- Resolved mock logic in Sovereignty Meter quests.

### Changed

- **Sovereign_State.md**: Downgraded from `[PRODUCTION_READY]` to `[BETA]` with honest per-feature status breakdown.
- **Business_State.md**: Replaced stub status tags with substantive business context.
- **PROJECT_CONTEXT.md**: Updated all file counts, line counts, test status, and resolved gap tracking.
- **GAPS_AND_RECOMMENDATIONS.md**: Marked 5 P0 gaps as resolved; added 7 newly discovered gaps (#31-#37).
- **AGENTS.md**: Updated service line counts, component counts, test file counts.
- **README.md**: Updated Node.js requirement to v20+, added `IMPLEMENTATION_REGISTRY.md` to project docs.

### Security

- Gated Liquid peg-in (`fetchLiquidPegInAddress`) to throw instead of returning fake addresses.
- Gated NTT bridge and swap services with explicit experimental warnings.
- Removed Google Fonts CDN dependency (IP leakage prevention, offline-first).

## [0.3.0] - 2026-01-22

### Added

- Android SecureEnclave plugin backed by Android Keystore AES-GCM.
- Optional biometric/device-credential vault gate with authenticated-key protection.
- Vault existence detection and resume logic (use existing wallet if present; otherwise onboarding).
- Offline-safe Tailwind bundling (no CDN dependency) for consistent mobile UI styling.
- Lock screen destructive reset option for creating a new wallet when needed.

### Changed

- SVN version alignment across app, docs, and release hub.
- Lightning backend alignment to LND-only support and safer endpoint handling.
- Persistence sanitization to prevent mnemonic/passphrase from being re-persisted at rest.

### Fixed

- Android Gradle namespace/manifest compatibility issues for modern AGP.
- Test environment polyfills for crypto/TextEncoder/TextDecoder so vault tests run consistently.

### Security

- Session-only seed usage for signing; seed bytes are zeroed after signing operations.
- Reduced risk of accidental secret persistence via state sanitization.
