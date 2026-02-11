---
title: AI Agent Guide
layout: page
permalink: /agents
---

# Conxius Wallet: AI Agent Guide

Welcome, Sovereign Agent. This document provides instructions and context for working with the Conxius Wallet codebase.

**Last Updated:** 2026-02-14
**Session Context:** See `PROJECT_CONTEXT.md` for current state  
**Feature Status:** See `IMPLEMENTATION_REGISTRY.md` for real vs mocked vs missing

---

## 🛡️ Core Principles

1. **Sovereign by Design**: Always prioritize user sovereignty and privacy.
2. **Zero Secret Egress**: Never log, transmit, or expose private keys or mnemonics.
3. **Local-First**: Prefer on-device solutions (Android Keystore, local storage) over cloud dependencies.
4. **Truthful Shipping**: Ensure features are fully implemented to standard before marking them as "production ready".
5. **Non-Custodial**: Conxian Labs never possesses, manages, or controls user funds.

---

## 🏗️ Verified Architecture (Production)

Conxius is an Android-first wallet built using:

### Frontend Layer

- **Framework:** React 19.2.3 + TypeScript 5.9.3
- **Build:** Vite 7.3.1 + Rollup
- **Styling:** Tailwind CSS v4.1.18
- **Mobile Bridge:** Capacitor 8.x for Android integration

### Native Security Layer (The Conclave)

- **Secure Enclave:** `SecureEnclavePlugin.java` (1,081 lines)
  - Android Keystore AES-GCM-256 encryption
  - BiometricPrompt with BIOMETRIC_STRONG + DEVICE_CREDENTIAL
  - StrongBox/TEE hardware enforcement (Android P+)
  - PBKDF2-HMAC-SHA256 key derivation (200,000 iterations)
  - 5-minute session caching with secure memory wiping
- **Crypto Libraries:** bitcoinj 0.16.3, web3j (EVM signing)
- **Storage:** Android SharedPreferences (encrypted via Keystore)

### Blockchain Support (Verified Implementation)

| Layer | Derivation Path | Status |
|-------|-----------------|--------|
| Bitcoin (Native Segwit) | `m/84'/0'/0'/0/0` | ✅ Production |
| Bitcoin (Taproot) | `m/86'/0'/0'/0/0` | ✅ Production |
| Stacks | `m/44'/5757'/0'/0/0` | ✅ Production |
| Rootstock/EVM | `m/44'/60'/0'/0/0` | ✅ Production |
| Liquid | `m/84'/1776'/0'/0/0` | ✅ Production |
| Nostr | `m/44'/1237'/0'/0/0` | ✅ Production |
| Web5 (TBD) | did:dht:... | ✅ Production |

### Key Services (Verified Code)

- `/services/signer.ts` (459 lines): Multi-layer signing, PSBT support, BIP-322
- `/services/enclave-storage.ts` (211 lines): Secure blob storage with biometric gating
- `/services/protocol.ts` (245 lines): Multi-chain balance fetching, transaction broadcast
- `/services/psbt.ts` (249 lines): PSBT creation, signing, finalization
- `/services/seed.ts` (98 lines): Seed encryption/decryption with PBKDF2
- `/services/ntt.ts` (82 lines): NTT bridge — **BLOCKED** (Needs Contracts)
- `/services/swap.ts` (107 lines): Changelly/THORChain swaps — **BLOCKED** (Needs Proxy)
- `/services/lightning.ts` (52 lines): LNURL/Bolt11 decode
- `/services/identity.ts` (137 lines): DID:PKH + SIWx auth

---

## 📁 Key Directories

- `/components`: 38 React UI components
  - `Dashboard.tsx`: Multi-asset portfolio view
  - `PaymentPortal.tsx`: Send/receive flows
  - `NTTBridge.tsx`: Cross-chain Native Token Transfers — **EXPERIMENTAL**
  - `SilentPayments.tsx`: BIP-352 — **EXPERIMENTAL** (uses mock seed)
- `/services`: Core business logic (32 modules — signing, protocol adapters, storage)
- `/android`: Capacitor Android project (SecureEnclavePlugin, BreezPlugin, NativeCrypto)
- `/tests`: 11 test files (signer, protocol, enclave-storage, seed, crypto, sovereignty, etc.)
- `/docs`: Extended documentation (PRD, Whitepaper, Analysis)
- `IMPLEMENTATION_REGISTRY.md`: **Authoritative feature status document**

---

## 🛠️ Build & Development

### Prerequisites

- Node.js v20.0.0+
- npm v9.0.0+
- Android Studio Hedgehog (2023.1.1)+
- Android SDK API level 23+
- JDK 17
- Gradle 8.0+

### Frontend

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
# Port: 3000 (configured in vite.config.ts)

# Build production
npm run build

# Run tests
npm test
```

### Android

```bash
# Sync Capacitor
npx cap sync

# Build Android
cd android && ./gradlew assembleDebug

# Run unit tests
cd android && ./gradlew :app:testDebugUnitTest
```

---

## 🧪 Testing Guidelines

### Current Test Status

- **12 test files** covering crypto, storage, notifications, sovereignty, and core services
- **✅ Critical Services Covered:** `signer.ts`, `enclave-storage.ts`, `protocol.ts` now have comprehensive test suites
- See `GAPS_AND_RECOMMENDATIONS.md` for systematic test expansion plan

### Testing Standards

```bash
# Frontend Tests
npm test  # Vitest runner

# Android Tests
cd android && ./gradlew :app:testDebugUnitTest
```

### Security Checks (Mandatory)

Before submitting any change that handles sensitive data:

1. Verify that `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, and `spellCheck="false"` are set for all sensitive input fields.
2. Ensure no secret material is being logged (seed, private keys, macaroons).
3. Verify that the Android `FLAG_SECURE` is active in `MainActivity.kt`.
4. Confirm biometric authentication is required for high-value operations.
5. Check that `window.Buffer` polyfill doesn't expose secrets in browser console.

---

## 📜 Documentation Maintenance

When updating the repo, ensure the following files are synchronized:

### Project Tracking

- `PROJECT_CONTEXT.md`: **Session continuity and current state** ⭐ NEW
- `Sovereign_State.md`: Implementation readiness tracking
- `Business_State.md`: Business architecture status

### Product Documentation

- `PRD.md`: Product requirements (Section 8: Expansion Architecture)
- `CHANGELOG.md`: All notable changes
- `ROADMAP.md`: Technical milestones and business goals

### Legal & Compliance

- `RISK_REGISTRY.md`: Core legal defense and risk assessment
- `MONETIZATION.md`: Revenue strategy (SaaS & Affiliates)
- `PARTNERS_AND_COMPLIANCE.md`: Approved third-party vendor stack

### Planning

- `GAPS_AND_RECOMMENDATIONS.md`: **30 identified gaps with priorities** ⭐ NEW

---

## 🚨 Critical Knowledge

### Security Patterns (Verified in Code)

- **Memory-Only Seeds:** Decrypted seed resides in memory only during signing, zeroed immediately after
- **Biometric Re-Auth:** Critical actions require biometric re-authentication at OS level
- **Hardware Enforcement:** `StrongBox` preferred, falls back to `TEE`, warns on `SOFTWARE`
- **Session Caching:** 5-minute session with secure memory wiping on timeout

### Partner Integration Pattern

```
User → Conxius UI → Partner API (Transak/VALR/Changelly) → Blockchain
        ↓
   Conxian Labs = Software Provider (never touches funds)
```

### Non-Negotiable Constraints

1. **Never Touch Fiat:** No direct card payments to Conxian bank accounts
2. **No Shadow Ledgers:** Always fetch balances live from blockchain
3. **No Custody:** Conxian Labs never possesses user private keys
4. **UI Labeling:** Display "Powered by [Partner]" when entering regulated flows

---

## 🔍 Finding Context

### For New Sessions

1. Read `PROJECT_CONTEXT.md` first for current state
2. Check `GAPS_AND_RECOMMENDATIONS.md` for priority tasks
3. Review this file for architectural context
4. Run `git status` to verify working tree state

### Before Making Changes

1. Run tests: `npm test`
2. Check for security implications (see Security Checks above)
3. Update relevant documentation files
4. Follow priority order in GAPS_AND_RECOMMENDATIONS.md

---

## 🤝 Pre-Commit Protocol

1. **Test:** Run `npm test` and ensure all pass
2. **Security:** Verify no secrets in logs, proper input attributes set
3. **Documentation:** Update any changed docs (PRD, AGENTS, etc.)
4. **Sync:** Ensure `PROJECT_CONTEXT.md` reflects current state

---

*Remember: We are building sovereign financial infrastructure. Every line of code matters.*
