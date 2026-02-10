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

- **Non-BTC Fee Estimation**: Complete (Real-time fetch from Hiro, Blockstream, RSK Node).
- **Runes Balance Fetch**: Complete (Hiro Ordinals API integration).
- **Sovereign Layers — Liquid**: Partial (Balance fetch works; address derivation returns pubkey not address; peg-in gated as experimental).
- **Silent Payments (BIP-352)**: Partial (Key derivation + address encoding real; sending logic incomplete; UI uses real vault seed).
- **BIP-322 Message Signing**: Partial (Refactored to use Enclave signing; pending full witness validation).
- **Web5 Integration**: Partial (DID + DWN CRUD works but uses default KeyManager, not enclave-backed).
- **PayJoin (BIP-78)**: Partial (Real PayjoinClient integration but untested in production).
- **CSP Headers**: Partial (Present but uses unsafe-inline + unsafe-eval).
- **Root/Jailbreak Detection**: Partial (DeviceIntegrityPlugin implements heuristics; missing Play Integrity API).
- **Offline Fonts**: Complete (@fontsource packages).
- **Code Splitting**: Complete (React.lazy + Suspense for 25 routes).

### ⚠️ Experimental (Mocked — Not Safe for Real Funds)

- **Interlayer Interop (NTT Bridge)**: EXPERIMENTAL — Bridge execution returns mock tx hash. Wormhole SDK integration required.
- **Asset Swaps (Changelly)**: EXPERIMENTAL — Mock quotes + fake payinAddress. Real API integration required.
- **Gas Abstraction**: EXPERIMENTAL — Uses mocked executeGasSwap.
- **Liquid Peg-in**: EXPERIMENTAL — Gated with explicit error.
- **Marketplace**: EXPERIMENTAL — Mock product catalog.
- **Stacking Rewards**: EXPERIMENTAL — Hardcoded mock reward history.
- **Reserve System**: EXPERIMENTAL — Hardcoded (research dynamic auto-metrics driven:
    Safe against all attacks and system drainage and or operations) +-$42M TVL.
- **Studio (Ordinals/Runes)**: EXPERIMENTAL — UI exists, backend incomplete.

### ❌ Not Yet Implemented

- **Error Boundaries**: Missing (No React error boundary).
- **E2E Tests**: Missing (Zero Playwright/Cypress coverage).
- **Multi-Wallet Support** (M4): Not started.
- **Multi-Sig Vaults** (M6): Personas defined, no signing implementation.
- **ZK-STARK Verifier** (M10): Not started.
- **BitVM Research** (M11): Not started.
