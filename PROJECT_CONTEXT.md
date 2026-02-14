---
title: Conxius Wallet - Project Context
layout: page
permalink: /project-context
---

# Conxius Wallet - Project Context

**Last Updated:** 2026-02-10  
**Repository:** <https://github.com/conxian/conxius-wallet>  
**Branch:** main  

---

## 🎯 Project Overview

Conxius Wallet is a **Multi-Chain Sovereign Interface** - an Android-first non-custodial wallet bridging Bitcoin ecosystem (L1, Lightning, Stacks, Rootstock, Liquid, Nostr) with hardware-level security via The Conclave TEE.

**Legal Classification:** Software Provider (not Financial Intermediary)  
**Architecture:** Non-custodial with regulated third-party partners  
**Overall Status:** BETA — See `IMPLEMENTATION_REGISTRY.md` for full feature-level status

---

## 📁 Repository Structure

```
Conxius-Wallet/
├── android/                    # Capacitor Android project
│   └── app/src/main/java/com/conxius/wallet/
│       ├── SecureEnclavePlugin.java   (1,081 lines - TEE implementation)
│       ├── BreezPlugin.java           (297 lines - Lightning SDK)
│       └── NativeCrypto.java          (56 lines - Vault decryption)
├── components/                 # 37 React components
│   ├── Dashboard.tsx           (Multi-asset portfolio view)
│   ├── PaymentPortal.tsx       (Send/receive flows)
│   ├── NTTBridge.tsx           (Cross-chain bridge — EXPERIMENTAL)
│   └── ...
├── services/                   # Core business logic (18 modules)
│   ├── signer.ts              (459 lines - Multi-layer signing)
│   ├── enclave-storage.ts     (211 lines - Secure storage)
│   ├── protocol.ts            (245 lines - Blockchain APIs)
│   ├── psbt.ts                (249 lines - PSBT handling)
│   ├── seed.ts                (98 lines - Seed encryption)
│   ├── ntt.ts                 (82 lines - NTT bridge — EXPERIMENTAL)
│   ├── swap.ts                (107 lines - Swaps — EXPERIMENTAL)
│   ├── lightning.ts           (52 lines - LNURL/Bolt11)
│   ├── nostr.ts               (100 lines - NIP-01 Nostr events)
│   ├── evm.ts                 (130 lines - Keccak256 + EIP-55)
│   ├── web5.ts                (149 lines - DID + DWN)
│   ├── identity.ts            (137 lines - DID:PKH + SIWx)
│   ├── silent-payments.ts     (96 lines - BIP-352)
│   ├── payjoin.ts             (81 lines - BIP-78)
│   ├── privacy.ts             (54 lines - Privacy scoring)
│   ├── gemini.ts              (243 lines - AI features)
│   ├── governance.ts          (99 lines - Ops personas)
│   └── FeeEstimator.ts        (98 lines - Fee estimation)
├── tests/                      # Test suite (12 files)
│   ├── setup.ts               (Test environment polyfills)
│   ├── signer.test.ts         (230 lines - Key derivation + signing)
│   ├── protocol.test.ts       (515 lines - Balance/broadcast/price)
│   ├── enclave-storage.test.ts (311 lines - Storage + native mocks)
│   └── ...
├── docs/                       # Extended documentation
├── .github/workflows/ci.yml   # CI pipeline (lint, tsc, test, build, audit, TruffleHog)
├── package.json               # Dependencies (pinned versions)
├── vite.config.ts             # Build config (CSP headers, localhost)
└── tsconfig.json              # TypeScript config
```

---

## 🛡️ The Conclave (TEE) Architecture

### Implementation Status: PRODUCTION ✅

**SecureEnclavePlugin.java Features:**

- Android Keystore AES-GCM-256 encryption
- BiometricPrompt integration (BIOMETRIC_STRONG + DEVICE_CREDENTIAL)
- StrongBox/TEE hardware enforcement (Android P+)
- PBKDF2-HMAC-SHA256 key derivation (200k iterations)
- 5-minute session caching with secure memory wiping
- Multi-asset key derivation (BTC, STX, RBTC, Liquid)

**Security Levels:**

- `STRONGBOX` - Dedicated secure hardware (preferred)
- `TEE` - Trusted Execution Environment
- `SOFTWARE` - Software-only keystore (fallback warning)

**Key Derivation Paths:**

- Bitcoin Native Segwit: `m/84'/0'/0'/0/0`
- Bitcoin Taproot: `m/86'/0'/0'/0/0`
- Stacks: `m/44'/5757'/0'/0/0`
- Rootstock/EVM: `m/44'/60'/0'/0/0`
- Liquid: `m/84'/1776'/0'/0/0`
- Nostr: `m/44'/1237'/0'/0/0`
- Web5 (TBD): m/44'/927'/0'/0/0
- Web5 (TBD): m/44/927/0/0/0

---

## 🤝 Regulated Partner Stack

### Approved Partners

| Service | Partner | Role | Compliance |
|---------|---------|------|------------|
| Fiat On-Ramp | **Transak** | UI Widget + KYC | User leaves app, partner handles all compliance |
| ZAR Banking | **VALR** | FSP #53308 | Licensed SA financial services provider |
| Token Swaps | **Changelly** | Counterparty | AML screening on all trades |
| Lightning | **Breez SDK** | LSP (Greenlight) | Non-custodial channels, cloud nodes |

### Partner Integration Pattern

```
User → Conxius UI → Partner API → Blockchain
        ↓
   [Referral Fee]  ← Conxian Labs never touches funds
```

---

## 🔧 Tech Stack

### Frontend

- **Framework:** React 19.2.3 + TypeScript 5.9.3
- **Build:** Vite 7.3.1
- **Styling:** Tailwind CSS 4.1.18
- **Icons:** Lucide React
- **Mobile:** Capacitor 8.x (Android)

### Native Layer

- **Crypto:** bitcoinj 0.16.3
- **Web3:** web3j (EVM signing)
- **Security:** Android Keystore, BiometricPrompt
- **Storage:** SharedPreferences (encrypted)

### Testing

- **Runner:** Vitest 4.0.17
- **DOM:** jsdom 27.4.0
- **Utils:** @testing-library/react 16.3.2

---

## 📊 Implementation Status

> **Full feature-level detail:** See `IMPLEMENTATION_REGISTRY.md`

### ✅ Production-Ready

| Feature | Evidence |
|---------|----------|
| SecureEnclavePlugin | 1,081 lines, AES-GCM-256, Biometric, StrongBox |
| Multi-chain derivation | BTC, Taproot, STX, RBTC, Liquid, Nostr — JS + Native |
| PSBT signing | Standard BTC + sBTC peg-in + Taproot tweak |
| sBTC Peg-in | `createSbtcDeposit` in signer.ts (Mainnet-ready) |
| Boltz Swaps | `services/boltz.ts` (Submarine & Reverse atomic swaps) |
| Biometric gating | 5-min session, duress PIN, re-auth required |
| Lightning (Breez SDK) | Native plugin: invoice, pay, LNURL-Auth |
| CI/CD pipeline | GitHub Actions: `ci.yml`, `deploy-proxy.yml` |
| Core service tests | signer (230), protocol (515), enclave-storage (311) |

### ⚠️ Experimental (Mocked — Not Safe for Real Funds)

| Feature | Issue |
|---------|-------|
| Runes Balance | Always returns empty array |
| Wormhole Bridge | Refactored to Token Bridge. Needs Mainnet testing. |

### 🛑 Blocked (Waiting for Infrastructure)

| Feature | Blocker |
|---------|---------|
| Changelly Swaps | Proxy deployed, waiting for `CHANGELLY_API_KEY` |
| Bisq DEX | Node deployed, waiting for gRPC connection test |

| Feature | Missing Dependency | Action Required |
|---------|-------------------|-----------------|
| **NTT Bridge** | Wormhole Contracts | Deploy TokenManager on Mainnet |
| **Changelly Swaps** | Backend Proxy | Deploy `VITE_CHANGELLY_PROXY_URL` |
| **Bisq DEX** | Bisq Daemon + Proxy | Deploy `VITE_BISQ_PROXY_URL` |
| **Marketplace** | API Keys | Acquire keys for Bitrefill |
| **Liquid Peg-in** | Federation Script | Configure `LIQUID_FEDERATION_SCRIPT` |

### ❌ Missing

| Feature | PRD Reference |
|---------|--------------|
| Root/jailbreak detection | NFR-SEC-03 |
| Offline fonts (Google CDN dependency) | NFR-REL-01 |
| Code splitting | P1 Gap #8 |
| Error boundaries | P1 Gap #11 |
| E2E tests | P1 Gap #6 |

### 🔄 Recently Resolved (2026-02-10)

- ~~No tests for core services~~ → signer, protocol, enclave-storage tests exist
- ~~No CI/CD pipeline~~ → `.github/workflows/ci.yml` operational
- ~~`.gitignore` missing `.env*.local`~~ → `*.local` covered
- ~~Wildcard `@google/genai: "*"`~~ → Pinned to `^1.40.0`
- ~~Vite host `0.0.0.0`~~ → Changed to `127.0.0.1`
- ~~No CSP headers~~ → Added to vite.config.ts
- ~~Wrong CoinGecko ID for STX~~ → Fixed to 'stacks'
- ~~Hardcoded STX price~~ → Now fetches dynamically
- ~~Dead `seed` reference in signer.ts~~ → Removed
- ~~STX address placeholder on native~~ → Derives from getAddressFromPublicKey
- ~~Fake Liquid peg-in address~~ → Now throws explicit experimental error
- ~~Double plugin registration in biometric.ts~~ → Uses shared SecureEnclave export

---

## 💰 Monetization Strategy

### Current: Affiliate Commissions

- **Transak:** 0.5-1% of transaction volume
- **Changelly:** 0.25-0.5% of spread
- **One-time** per transaction

### Future: Streaming Fees (SaaS Model)

- "Conclave Pro" subscription: ~$2.60/month equivalent
- Priority support: ~$26/month
- Advanced analytics: ~$13/month
- Multi-sig coordination: ~$52/month

**Legal Advantage:** Software service fees ≠ financial management fees

---

## 🚨 Risk Registry Summary

| Risk | Mitigation |
|------|------------|
| CASP Classification (FSCA) | Non-custodial TEE proof, no pooling |
| AML/CFT | Partner reliance (Transak/VALR handle KYC) |
| SEC Broker-Dealer | Direct routing, no order matching |
| Enclave Breach | Memory-only handling, biometric re-auth |
| Partner Failure | "Basic Mode" - pure P2P on-chain fallback |

---

## 🔄 Session Continuity Notes

### Session 2026-02-10 — Full Repo Review & Remediation

**Code Bugs Fixed:**

- Dead `seed` reference in `signer.ts` finally blocks (compile error)
- STX address placeholder on native path → uses `getAddressFromPublicKey`
- Hardcoded STX price → fetches dynamically via `fetchStxPrice()`
- CoinGecko ID `blockstack` → `stacks`
- Fake Liquid peg-in addresses → throws explicit experimental error
- Double plugin registration in `biometric.ts` → imports shared instance

**Features Gated as Experimental:**

- NTT bridge (`ntt.ts`) — `NTT_EXPERIMENTAL` flag + console warnings
- Changelly swaps (`swap.ts`) — `SWAP_EXPERIMENTAL` flag + console warnings
- Liquid peg-in (`protocol.ts`) — throws Error on call

**Documentation Created/Updated:**

- Created `IMPLEMENTATION_REGISTRY.md` — full real vs mocked vs missing registry
- Updated `Sovereign_State.md` — honest per-feature status (BETA overall)
- Updated `Business_State.md` — substantive content replacing stub tags
- Updated `PROJECT_CONTEXT.md` — this file

### Priority Queue for Next Session

1. **Self-host Google Fonts** — Download to `/public/fonts/` (offline-first requirement)
2. **Update GAPS_AND_RECOMMENDATIONS.md** — Mark 5 P0s as resolved, add new findings
3. **Update AGENTS.md** — Sync file counts, test status, architecture notes
4. **Update CHANGELOG.md** — Add [Unreleased] entries
5. **Silent Payments mock seed fix** — `SilentPayments.tsx` uses `Buffer.alloc(64,0)`
6. **Changelly fake payinAddress** — Must block UI or integrate real API
7. **Root detection** — Integrate SafetyNet/Play Integrity
8. **Code splitting** — React.lazy() for all routes
9. **Error boundaries** — Wrap component tree

---

## 📚 Documentation Files

| File | Purpose | Status |
|------|---------|--------|
| `PROJECT_CONTEXT.md` | This file — session continuity | ✅ Updated 2026-02-10 |
| `IMPLEMENTATION_REGISTRY.md` | Real vs mocked vs missing per PRD | ✅ Created 2026-02-10 |
| `AGENTS.md` | AI agent guide | ⚠️ Needs update (file counts stale) |
| `GAPS_AND_RECOMMENDATIONS.md` | 30 gaps with priorities | ⚠️ Needs update (5 P0s resolved) |
| `PRD.md` | Product requirements | ✅ Current |
| `RISK_REGISTRY.md` | Legal defense document | ✅ Current |
| `MONETIZATION.md` | Revenue strategy | ✅ Current |
| `PARTNERS_AND_COMPLIANCE.md` | Approved vendors | ✅ Current |
| `Sovereign_State.md` | Implementation status | ✅ Updated 2026-02-10 |
| `Business_State.md` | Business tracking | ✅ Updated 2026-02-10 |
| `ROADMAP.md` | Technical milestones | ✅ Current |
| `WHITEPAPER.md` | Security architecture | ✅ Current |
| `README.md` | Getting started | ⚠️ Needs update (Node 20+) |
| `CHANGELOG.md` | Version history | ⚠️ Needs [Unreleased] entries |

---

**Maintained by:** Cascade AI Agent  
**Review Cycle:** Every session start  
**Owner:** Conxian Labs

- **Resolved Build Errors**: Fixed TypeScript compilation errors in `signer.ts`, `ntt.ts`, `boltz.ts`, and `NTTBridge.tsx`. Verified successful build with `npm run build`.
