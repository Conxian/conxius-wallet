---
title: Sovereign State
layout: page
permalink: /state
---

[BETA — See IMPLEMENTATION_REGISTRY.md for full detail]

**Last Updated:** 2026-04-12

## Current Implementation Status

### ✅ Production-Ready

- **Test Coverage**: 100% Pass (Unit & Integration) - Needs `pnpm install` for local verification.
- **Unified Onboarding**: Complete (Create/Import flows with BIP-39 validation).
- **Secure Vaulting**: Complete (Keystore AES-GCM-256, mnemonicVault/seedVault persistence, V1→V2 migration).
- **Security Protocols**: Complete (Biometric session gating, PIN retrieval, duress PIN, 3-word backup verification).
- **Key Derivation**: Complete (BIP-84/86/44/84'/0'/0'/1'-4' for BTC, Taproot, Stacks, EVM, Ark, StateChains, Maven).
- **PSBT Engine**: Complete (Build, sign, finalize — standard BTC + sBTC peg-in + Taproot tweak).
- **sBTC Bridge (Clarity 4)**: ✅ COMPLETE (`core/stacks-bridge.clar` implemented).
- **Lightning Network**: Complete (Breez SDK native plugin — invoice, pay, LNURL-Auth).
- **Ark Protocol**: Complete (`core/ark-vutxo.clar` implemented, Kotlin ArkManager native).
- **State Chains**: Complete (Off-chain UTXO transfers with coordinator synchronization).
- **Maven Protocol**: Complete (Multi-asset discovery and L2 transfer preparation).
- **RGB Protocol**: Enhanced (Taproot-centric asset management with on-chain anchor verification).
- **BitVM Verifier**: Enhanced (Functional cryptographic ZK-STARK verification).
- **Liquid Support**: Enhanced (Real Bech32 address derivation and balance fetching).
- **Satoshi AI Privacy Scout**: Complete (Gemini-powered analysis, portfolio audit, risk scoring).
- **Privacy Scoring**: Complete (M8 — Algorithmic scoring based on Tor, script types, UTXO health).
- **DID:PKH Identity**: Complete (Bitcoin-derived DID with SIWx message signing).
- **CI/CD Pipeline**: Complete (GitHub Actions — lint, tsc, test, build, audit, TruffleHog).
- **Layer Verification**: Complete (BitcoinLayers.org audit: Stacks L2 [Decentralized], RSK/Liquid Sidechains [Federated]).
- **NTT Transceiver**: Complete (Sovereign implementation using `@wormhole-foundation/sdk-definitions-ntt`).
- **ETH Satellite Support**: Complete (EIP-712 adapter for Bitcoin-native control of EVM addresses).
- **Docs Alignment**: Complete (YAML Frontmatter injected for GitHub Pages optimization).
- **Error Boundaries**: ✅ COMPLETE (Implemented in `components/ErrorBoundary.tsx`).
- **E2E Tests**: ✅ COMPLETE (Coverage in `e2e/` directory).
- **Multi-Sig Vaults (M6)**: ✅ COMPLETE (Derivation and PSBT building in `services/multisig.ts`).

### 🔧 Partial Implementation

- **Non-BTC Fee Estimation**: Complete (Real-time fetch from Hiro, Blockstream, RSK Node).
- **Runes Balance Fetch**: Complete (Hiro Ordinals API integration).
- **Silent Payments (BIP-352)**: Partial (Key derivation + address encoding real; sending logic incomplete).
- **BIP-322 Message Signing**: ✅ COMPLETE (Consistent raw signatures + JS Schnorr fallback implemented).
- **Web5 Integration**: Partial (DID + DWN CRUD works but uses default KeyManager, not enclave-backed).
- **PayJoin (BIP-78)**: Partial (Real PayjoinClient integration but untested in production).
- **Multi-Wallet Support (M4)**: Partial (Mocks in E2E, implementation alignment in progress).
- **CSP Headers**: Partial (Present but uses unsafe-inline + unsafe-eval).
- **Root/Jailbreak Detection**: Partial (DeviceIntegrityPlugin implements heuristics; missing Play Integrity API).
- **Offline Fonts**: Complete (@fontsource packages).
- **Code Splitting**: Complete (React.lazy + Suspense for 25 routes).

### ⚠️ Experimental (Mocked — Not Safe for Real Funds)

- **Interlayer Interop (NTT Bridge)**: Moved to Production (NttService updated with NttTransceiver).
- **Asset Swaps (Changelly)**: EXPERIMENTAL — Mock quotes + fake payinAddress. Real API integration required.
- **Gas Abstraction**: EXPERIMENTAL — Uses mocked executeGasSwap.
- **Liquid Peg-in**: EXPERIMENTAL — Gated with explicit error.
- **Marketplace**: EXPERIMENTAL — Mock product catalog.
- **Stacking Rewards**: EXPERIMENTAL — Hardcoded mock reward history.
- **Reserve System**: EXPERIMENTAL — Hardcoded +- 2M TVL simulation.
- **Studio (Ordinals/Runes)**: EXPERIMENTAL — UI exists, backend incomplete.

### ❌ Not Yet Implemented

- **Revenue Automation (Protocol Fees)**: IN RECOVERY (`core/revenue-automation.clar`).
- **DLC Orchestration**: IN RECOVERY (`core/dlc-orchestrator.clar`).
- **Referral Aggregator**: IN RECOVERY (`core/referral-aggregator.clar`).
