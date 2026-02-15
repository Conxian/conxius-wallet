---
title: Changelog
layout: page
permalink: /changelog
---

# Changelog

## [0.3.3] - 2026-02-15

### Added
- **Full Bitcoin Ecosystem Alignment**: Expanded protocol support to include BOB (EVM L2), RGB, Ark, BitVM, Maven, and generic State Chains.
- **Ecosystem Architecture Support**: Added derivation paths and signing placeholders for new layers in `signer.ts` (EVM/Taproot compatible).
- **Native Protocol Scaffolding**: Integrated fetchers for BOB, RGB, Ark, Maven, and State Chains in `protocol.ts`.
- **Ecosystem UI Expansion**: Updated Dashboard to include new layers in the asset sync and receive flows. Added RGB asset issuance tab to Studio.

### Changed
- **Documentation Overhaul**: Comprehensive updates to `PRD.md`, `WHITEPAPER.md`, `ROADMAP.md`, `IMPLEMENTATION_REGISTRY.md`, and `AGENTS.md` to reflect the "Full Bitcoin Ecosystem" vision.
- **Gaps Tracking**: Added detailed gaps and recommendations for future implementation of BOB, Ark, RGB, and BitVM.

### Fixed
- **UI Code Quality**: Fixed several syntax errors and missing commas in `Dashboard.tsx` and `Studio.tsx` introduced during ecosystem expansion.
- **Type Safety**: Updated `BitcoinLayer` and `Asset` types to include new ecosystem protocols.
- **Gemini Integration**: Fixed `LabsExplorer.tsx` to use correct `GoogleGenAI` SDK methods for blueprint synthesis.

## [0.3.1] - 2026-02-15

### Fixed
- **BIP-322 Signature Alignment**: Standardized native signing logic to return raw 64-byte signatures for Bitcoin, aligning Android with EVM/Stacks and JS fallbacks.
- **BIP-322 Witness Structure**: Corrected witness stack serialization in `services/signer.ts`; now returns full base64-encoded witness stack instead of partial hex.
- **Taproot Signing (JS)**: Added real Schnorr signature support to BIP-322 JS fallback using `@noble/curves`.
- **Test Environment**: Switched Vitest to `jsdom` for better React component testing support.
- **CI Consistency**: Enforced `--frozen-lockfile` in GitHub Actions and removed redundant `package-lock.json`.

### Changed
- **Sovereignty Meter**: Renamed `MOCK_QUESTS` to `ACTIVE_QUESTS` to reflect that logic is fully state-driven.

### Security
- **Project Cleanup**: Removed dead root files (`enclave_plugin_backup.java`, `enclave_plugin_cycle2.java`, etc.) to reduce repository attack surface.
- **Pre-commit Hooks**: Integrated `husky` and `lint-staged` to enforce linting and testing before every commit.


All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project aims to follow Semantic Versioning.

## [Unreleased]

## [0.3.2] - 2026-02-14

### Added

- **Persistent Crypto Worker**: Ported high-performance primitives to a singleton Web Worker model (`services/crypto.worker.ts`). This eliminates worker spawning overhead and implements session-level caching for PBKDF2 (200k+ iterations) and BIP32 derivation nodes, targeting a >90% reduction in address derivation latency.
- **ECC Engine Fusion**: Integrated `@noble/curves` for high-speed point arithmetic, specifically for Taproot tweaking using BigInt-level coordinate access (`P.hasEvenY()`). Retained `tiny-secp256k1` for deterministic signing compatibility.
- **Interlayer Orchestration**: Transitioned NTT execution to PRODUCTION status. Replaced placeholders with real `NTT_CONFIGS` for sBTC and cross-chain transfers. Parallelized transaction retrieval using `Promise.all` and integrated real-time VAA retrieval via the Wormhole API.
- **Memory Hardening**: Maintained strict 'Zero-Leak' memory hardening by zero-filling sensitive buffers in `finally` blocks and ensuring session-level caches are cleared on lock/reset.

## [0.3.1] - 2026-02-14

### Added

- **Implementation Registry** (`IMPLEMENTATION_REGISTRY.md`): Authoritative document tracking real vs mocked vs missing features across all services, components, and PRD requirements.
- **Experimental Feature Gating**: `NTT_EXPERIMENTAL`, `SWAP_EXPERIMENTAL` flags with console warnings on mocked services (`ntt.ts`, `swap.ts`).
- **Self-hosted Fonts**: Replaced Google Fonts CDN with `@fontsource/inter` and `@fontsource/jetbrains-mono` npm packages for offline-first compliance.
- **Privacy Scoring Engine**: Dynamic privacy risk assessment based on script types (Taproot), network status (Tor), and UTXO analysis.
- **Physical Backup Audit**: PIN-gated manual verification flow for mnemonic backups against the Secure Enclave.
- **Satoshi AI Privacy Scout**: Context-aware AI assistant that provides proactive privacy and UTXO management advice.
- **Privacy Enclave UI**: Real-time visualization of sovereignty metrics and security recommendations.
- **Wormhole SDK Integration** (`ntt.ts`): Scaffolded real Wormhole NTT bridge with SDK initialization, chain config, and transfer flow. Experimental mock path retained until NTT contracts deployed.
- **liquidjs-lib Integration** (`services/liquid.ts`): New Liquid service with proper P2WPKH address derivation, confidential address support, and peg-in/peg-out scaffolding via `liquidjs-lib`.
- **Device Integrity Plugin** (`DeviceIntegrityPlugin.java`, `services/device-integrity.ts`): Multi-layered Android root detection (su binary, root apps, system props, test-keys, emulator) with Capacitor TypeScript bridge. Registered in `MainActivity.kt`.
- **Error Boundaries** (`components/ErrorBoundary.tsx`): Scoped error boundary component with retry button, error details, and enclave integrity assurance. Wraps all route content in `App.tsx` keyed by `activeTab`.
- **Code Splitting**: 25 secondary route components converted to `React.lazy` with `Suspense` fallback for reduced initial bundle size.
- **Playwright E2E Tests** (`e2e/app.spec.ts`, `playwright.config.ts`): E2E test infrastructure with boot sequence, secret leakage, navigation, error boundary, and console security tests. Scripts: `npm run test:e2e`, `npm run test:e2e:ui`.
- **Changelly API v2 Scaffolding** (`swap.ts`): Real JSON-RPC 2.0 proxy architecture with `changellyRpc()`, `VITE_CHANGELLY_PROXY_URL` env var, and hard-blocked `createChangellyTransaction` to prevent fund loss from mock addresses.

### Fixed

- **signer.ts**: Refactored BIP-322 signing to use Secure Enclave pattern (`requestEnclaveSignature`) instead of direct mnemonic access. Securely constructs virtual transaction in JS and signs sighash in TEE.
- **FeeEstimator.ts**: Replaced hardcoded fallback fees with real-time API fetches for Stacks (Hiro), Liquid (Blockstream), and RSK (Public Node).
- **protocol.ts**: Fixed Runes balance fetch by prioritizing Hiro Ordinals API (reliable) over ordinals.com (DNS failure).
- **Android Build**: Fixed `MainActivity.kt` crash by removing bogus `System.loadLibrary("conxius_core")` call.
- **Android Build**: Resolved Gradle 9.0 plugin conflicts (`kotlin-android` duplicate extension) and `compileSdk` configuration errors.
- **signer.ts**: Removed dead `seed` variable reference in two `finally` blocks that would cause `ReferenceError` at runtime.
- **signer.ts**: Fixed STX address derivation on native path — now uses `getAddressFromPublicKey` instead of returning placeholder `"SP..."`.
- **protocol.ts**: `fetchStacksBalances` now fetches real-time STX price via `fetchStxPrice()` instead of hardcoded `$2.45`.
- **protocol.ts**: Fixed CoinGecko API ID from `blockstack` (deprecated) to `stacks` in `fetchStxPrice()`.
- **protocol.ts**: Liquid peg-in address now delegates to `services/liquid.ts` with proper `liquidjs-lib` integration.
- **biometric.ts**: Eliminated double `registerPlugin('SecureEnclave')` — now imports shared instance from `enclave-storage.ts`.
- **SilentPayments.tsx**: Replaced mock seed `Buffer.alloc(64,0)` with real vault seed decryption via PIN prompt. Added memory hardening (seed/key wiping), experimental banner, and unlock gate UI.
- Improved Satoshi AI system prompt for better integration with on-device wallet state.
- Resolved mock logic in Sovereignty Meter quests.

### Changed

- **Sovereign_State.md**: Downgraded from `[PRODUCTION_READY]` to `[BETA]` with honest per-feature status breakdown.
- **Business_State.md**: Replaced stub status tags with substantive business context.
- **PROJECT_CONTEXT.md**: Updated all file counts, line counts, test status, and resolved gap tracking.
- **GAPS_AND_RECOMMENDATIONS.md**: Marked 5 P0 gaps as resolved; added 7 newly discovered gaps (#31-#37).
- **AGENTS.md**: Updated service line counts, component counts, test file counts.
- **README.md**: Updated Node.js requirement to v20+, added `IMPLEMENTATION_REGISTRY.md` to project docs.
- **DeFiDashboard.tsx**: Sovereign Zap section now shows experimental warning and disabled button when `SWAP_EXPERIMENTAL` is true.
- **swap.ts**: Rewrote with Changelly API v2 architecture (JSON-RPC 2.0 via backend proxy), `isChangellyReady()` helper, and zero-value mock quotes.
- **App.tsx**: Refactored to use `React.lazy` for 25 components, wrapped route content in `ErrorBoundary` + `Suspense`.

### Security

- **SilentPayments**: Real vault seed with PIN authentication, memory-hardened key wiping after derivation.
- **Changelly**: Hard-blocked `createChangellyTransaction` — throws instead of returning mock `payinAddress`.
- **Root Detection**: Android native plugin checks su binary, root management apps, dangerous system props, test-keys builds, and emulator.
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
