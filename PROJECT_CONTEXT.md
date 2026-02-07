# Conxius Wallet - Project Context

**Last Updated:** 2026-02-07  
**Repository:** <https://github.com/conxian/conxius-wallet>  
**Branch:** main  
**Commit:** 2ff2a27f  

---

## 🎯 Project Overview

Conxius Wallet is a **Multi-Chain Sovereign Interface** - an Android-first non-custodial wallet bridging Bitcoin ecosystem (L1, Lightning, Stacks, Rootstock, Liquid, Nostr) with hardware-level security via The Conclave TEE.

**Legal Classification:** Software Provider (not Financial Intermediary)
**Architecture:** Non-custodial with regulated third-party partners

---

## 📁 Repository Structure

```
Conxius-Wallet/
├── android/                    # Capacitor Android project
│   └── app/src/main/java/com/conxius/wallet/
│       └── SecureEnclavePlugin.java   (836 lines - TEE implementation)
├── components/                 # 36 React components
│   ├── Dashboard.tsx          (488 lines)
│   ├── PaymentPortal.tsx      (1,071 lines)
│   ├── NTTBridge.tsx          (568 lines)
│   └── ...
├── services/                   # Core business logic
│   ├── signer.ts              (440 lines - Multi-layer signing)
│   ├── enclave-storage.ts     (193 lines - Secure storage)
│   ├── protocol.ts            (245 lines - Blockchain APIs)
│   ├── psbt.ts                (223 lines - PSBT handling)
│   ├── seed.ts                (114 lines - Seed encryption)
│   └── ...
├── tests/                      # Test suite (8 files)
│   ├── setup.ts
│   ├── crypto.test.ts
│   ├── seed.test.ts
│   └── ...
├── docs/                       # Extended documentation
├── .github/                    # (MISSING - needs workflows)
├── package.json               # Dependencies
├── vite.config.ts             # Build configuration
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

### ✅ COMPLETED

| Feature | Status | Evidence |
|---------|--------|----------|
| SecureEnclavePlugin | ✅ | 836 lines, AES-GCM, Biometric, StrongBox |
| Multi-chain derivation | ✅ | BTC, STX, RBTC, Liquid, Nostr paths |
| PSBT signing | ✅ | Full implementation in signer.ts |
| Biometric gating | ✅ | 5-min session, re-auth required |
| Dashboard | ✅ | 488 lines, multi-asset display |
| Payment Portal | ✅ | 1,071 lines, send/receive flows |
| NTT Bridge | ✅ | 568 lines, cross-chain transfers |
| Web5 Service | ✅ | TBD DIDs and DWN storage |
| Protocol service | ✅ | 245 lines, 5+ blockchain APIs |

### ⚠️ MISSING / GAPS

See `GAPS_AND_RECOMMENDATIONS.md` for full list of 30 identified gaps.

**Critical (P0):**

- No tests for signer.ts (440 lines, 0 tests)
- No tests for enclave-storage.ts (193 lines, 0 tests)
- No CI/CD pipeline
- `.gitignore` missing `.env*.local`

**High (P1):**

- No GitHub Actions
- No E2E tests
- No code splitting
- Vite security headers missing

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

### For Next Session

1. **Repository is clean** at `main` branch, commit `2ff2a27f`
2. **Remote correctly set** to `conxian/conxius-wallet`
3. **30 gaps identified** - see GAPS_AND_RECOMMENDATIONS.md
4. **Priority order established:**
   - P0: .gitignore fix, CI/CD, dependency pinning
   - P1: Core service tests, E2E setup
   - P2: Code splitting, security headers
   - P3: Streaming fees, partner redundancy

### Key Decisions Made

- ✅ Conclave architecture approved - STRONG ENHANCEMENT
- ✅ Partner model approved - compliance offloading
- ✅ Repository fixed - clean state achieved
- ✅ 30 gaps catalogued - ready for systematic fixes

---

## 📚 Documentation Files

| File | Purpose | Status |
|------|---------|--------|
| `PROJECT_CONTEXT.md` | This file - session continuity | ✅ Current |
| `AGENTS.md` | AI agent guide | Needs update |
| `GAPS_AND_RECOMMENDATIONS.md` | 30 gaps with priorities | Needs creation |
| `PRD.md` | Product requirements | ✅ Current |
| `RISK_REGISTRY.md` | Legal defense document | ✅ Current |
| `MONETIZATION.md` | Revenue strategy | ✅ Current |
| `PARTNERS_AND_COMPLIANCE.md` | Approved vendors | ✅ Current |
| `Sovereign_State.md` | Implementation status | Needs update |
| `Business_State.md` | Business tracking | Needs update |

---

**Maintained by:** Cascade AI Agent  
**Review Cycle:** Every session start  
**Owner:** Conxian Labs
