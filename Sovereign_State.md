---
title: Sovereign State
layout: page
permalink: /state
---

[BETA — See IMPLEMENTATION_REGISTRY.md for full detail]

**Last Updated:** 2026-02-10

## Current Implementation Status

### ✅ Production-Ready

- **Unified Onboarding**: Complete (Create/Import flows with BIP-39 validation).
- **Secure Vaulting**: Complete (Keystore AES-GCM-256, mnemonicVault/seedVault persistence, V1→V2 migration).
- **Security Protocols**: Complete (Biometric session gating, PIN retrieval, duress PIN, 3-word backup verification).
- **Key Derivation**: Complete (BIP-84/86/44 for BTC, Taproot, Stacks, EVM/RSK, Nostr — JS + native Android).
- **PSBT Engine**: Complete (Build, sign, finalize — standard BTC + sBTC peg-in + Taproot tweak).
- **Lightning Network**: Complete (Breez SDK native plugin — invoice, pay, LNURL-Auth).
- **Satoshi AI Privacy Scout**: Complete (Gemini-powered analysis, portfolio audit, risk scoring).
- **Privacy Scoring**: Complete (M8 — Algorithmic scoring based on Tor, script types, UTXO health).
- **DID:PKH Identity**: Complete (Bitcoin-derived DID with SIWx message signing).
- **CI/CD Pipeline**: Complete (GitHub Actions — lint, tsc, test, build, audit, TruffleHog).

### 🔧 Partial Implementation

- **Sovereign Layers — Liquid**: Partial (Balance fetch works; address derivation returns pubkey not address; peg-in gated as experimental).
- **Silent Payments (BIP-352)**: Partial (Key derivation + address encoding real; sending logic incomplete; UI uses mock seed).
- **BIP-322 Message Signing**: Partial (Returns prefixed hex, not full BIP-322 witness structure).
- **Web5 Integration**: Partial (DID + DWN CRUD works but uses default KeyManager, not enclave-backed).
- **PayJoin (BIP-78)**: Partial (Real PayjoinClient integration but untested in production).
- **CSP Headers**: Partial (Present but uses unsafe-inline + unsafe-eval).

### ⚠️ Experimental (Mocked — Not Safe for Real Funds)

- **Interlayer Interop (NTT Bridge)**: EXPERIMENTAL — Bridge execution returns mock tx hash. Wormhole SDK integration required.
- **Asset Swaps (Changelly)**: EXPERIMENTAL — Mock quotes + fake payinAddress. Real API integration required.
- **Gas Abstraction**: EXPERIMENTAL — Uses mocked executeGasSwap.
- **Runes Balance Fetch**: EXPERIMENTAL — Always returns empty array.
- **Non-BTC Fee Estimation**: EXPERIMENTAL — Hardcoded mock fees for Stacks/RSK/Liquid/Wormhole.
- **Marketplace**: EXPERIMENTAL — Mock product catalog.
- **Stacking Rewards**: EXPERIMENTAL — Hardcoded mock reward history.
- **Reserve System**: EXPERIMENTAL — Hardcoded $42M TVL.
- **Studio (Ordinals/Runes)**: EXPERIMENTAL — UI exists, backend incomplete.

### ❌ Not Yet Implemented

- **Root/Jailbreak Detection**: Missing (PRD NFR-SEC-03).
- **Offline Fonts**: Missing (Google Fonts loaded from CDN).
- **Code Splitting**: Missing (All components eagerly imported).
- **Error Boundaries**: Missing (No React error boundary).
- **E2E Tests**: Missing (Zero Playwright/Cypress coverage).
- **Multi-Wallet Support** (M4): Not started.
- **Multi-Sig Vaults** (M6): Personas defined, no signing implementation.
- **ZK-STARK Verifier** (M10): Not started.
- **BitVM Research** (M11): Not started.
