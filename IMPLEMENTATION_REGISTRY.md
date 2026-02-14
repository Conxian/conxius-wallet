---
title: Implementation Registry
layout: page
permalink: /implementation-registry
---

# Implementation Registry: Real vs Mocked vs Missing

**Last Updated:** 2026-02-10
**Purpose:** Single source of truth for what is production-ready, what is mocked/experimental, and what is missing entirely. Cross-referenced with PRD functional requirements.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| ✅ PRODUCTION | Real cryptographic implementation, tested, ready for mainnet |
| ⚠️ EXPERIMENTAL | Code exists but uses mocks, stubs, or incomplete logic — NOT safe for real funds |
| 🔧 PARTIAL | Core logic implemented but missing integration, edge cases, or tests |
| ❌ MISSING | Referenced in PRD/docs but no implementation exists |

---

## I. CORE SECURITY (The Conclave)

| Feature | File(s) | Status | Notes |
|---------|---------|--------|-------|
| Android Keystore AES-GCM-256 | `SecureEnclavePlugin.java` | ✅ PRODUCTION | StrongBox preferred, TEE fallback |
| BiometricPrompt (BIOMETRIC_STRONG) | `SecureEnclavePlugin.java:370-433` | ✅ PRODUCTION | 300s session, device credential fallback |
| PBKDF2-HMAC-SHA256 seed vault (200k iter) | `seed.ts`, `NativeCrypto.java` | ✅ PRODUCTION | Consistent across JS and Java |
| Session caching (5-min) | `SecureEnclavePlugin.java:74-78` | ✅ PRODUCTION | Secure wipe on expiry |
| Duress PIN (vault purge) | `App.tsx:222-234` | ✅ PRODUCTION | Wipes enclave + localStorage + sessionStorage |
| Vault migration (V1→V2) | `App.tsx:266-269`, `storage.ts` | ✅ PRODUCTION | Auto-upgrades legacy blobs |
| Memory wiping (seed zeroing) | `signer.ts` (finally blocks) | ✅ PRODUCTION | Fixed: dead `seed` ref removed |
| State sanitization before persist | `App.tsx` (sanitizeStateForPersistence) | ✅ PRODUCTION | Strips mnemonic/passphrase |
| Root/jailbreak detection | `DeviceIntegrityPlugin.java`, `device-integrity.ts` | ✅ PRODUCTION | Su binary, root apps, system props, emulator checks |
| FLAG_SECURE (anti-screenshot) | `MainActivity.kt` | ✅ PRODUCTION | Verified: `window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)` |

---

## II. KEY DERIVATION & SIGNING

| Feature | File(s) | Status | Notes |
|---------|---------|--------|-------|
| BIP-84 Native Segwit (m/84'/0'/0'/0/0) | `signer.ts`, `SecureEnclavePlugin.java` | ✅ PRODUCTION | Both JS and native paths |
| BIP-86 Taproot (m/86'/0'/0'/0/0) | `signer.ts` | ✅ PRODUCTION | Tweaked key derivation implemented |
| BIP-44 Stacks (m/44'/5757'/0'/0/0) | `signer.ts` | ✅ PRODUCTION | Fixed: native path now derives real address |
| BIP-44 EVM/RSK (m/44'/60'/0'/0/0) | `signer.ts`, `evm.ts` | ✅ PRODUCTION | Hand-rolled keccak256 + EIP-55 checksum |
| BIP-84 Liquid (m/84'/1776'/0'/0/0) | `signer.ts`, `liquid.ts` | ✅ PRODUCTION | liquidjs-lib P2WPKH + confidential address derivation |
| NIP-06 Nostr (m/44'/1237'/0'/0/0) | `nostr.ts` | ✅ PRODUCTION | Schnorr signing via tiny-secp256k1 |
| BIP-352 Silent Payments (m/352'/0'/0') | `silent-payments.ts` | 🔧 PARTIAL | Key derivation + address encoding real; sending logic incomplete |
| BIP-322 Message Signing | `signer.ts:163-192` | ✅ PRODUCTION | Full witness structure (to_spend/to_sign) implemented |
| PSBT build/sign/finalize | `psbt.ts` | ✅ PRODUCTION | Standard + sBTC peg-in + Taproot tweak support |
| Native enclave signing (Android) | `SecureEnclavePlugin.java:545+` | ✅ PRODUCTION | Full BIP-32 derivation in Java with bitcoinj |
| Batch signing | `enclave-storage.ts`, `signer.ts` | ✅ PRODUCTION | Conclave-gated batch with biometric |
| EVM transaction signing | `SecureEnclavePlugin.java` (web3j) | ✅ PRODUCTION | ECDSA via web3j Credentials |
| Wormhole Signer Adapter | `wormhole-signer.ts` | ✅ PRODUCTION | Implements Wormhole SDK Signer interface |

---

## III. BLOCKCHAIN PROTOCOL LAYER

| Feature | File(s) | Status | Notes |
|---------|---------|--------|-------|
| BTC balance fetch (mempool.space) | `protocol.ts:44-81` | ✅ PRODUCTION | Includes mempool pending |
| BTC UTXO fetch | `protocol.ts:130-155` | ✅ PRODUCTION | Returns full UTXO set with address |
| BTC tx broadcast | `protocol.ts:155-175` | ✅ PRODUCTION | With notification on success |
| BTC price feed (CoinGecko) | `protocol.ts:201-207` | ✅ PRODUCTION | Fallback to $68,500 |
| BTC fee estimation (mempool.space) | `FeeEstimator.ts:27-39` | ✅ PRODUCTION | Real-time hourFee fetch |
| STX balance fetch (Hiro API) | `protocol.ts:91-127` | ✅ PRODUCTION | Fixed: now fetches real STX price |
| STX price feed (CoinGecko) | `protocol.ts:209-215` | ✅ PRODUCTION | Fixed: CoinGecko ID corrected to 'stacks' |
| Runes balance fetch | `protocol.ts` | ✅ PRODUCTION | Primary: Hiro API, Fallback: Ordinals.com |
| Liquid balance fetch | `protocol.ts:175-190` | 🔧 PARTIAL | Uses blockstream.info API, real fetch |
| RSK balance fetch | `protocol.ts:190-200` | 🔧 PARTIAL | Uses public RSK node, real fetch |
| Liquid peg-in address | `protocol.ts`, `liquid.ts` | 🔧 PARTIAL | Real derivation implemented; requires federation script via RPC/GDK |
| Liquid peg-in monitoring | `protocol.ts:238-243` | 🔧 PARTIAL | Real API call but returns mock fallback |
| Non-BTC fee estimation | `FeeEstimator.ts` | ✅ PRODUCTION | Real-time fetch from Hiro (STX), Blockstream (L-BTC), RSK Node (RBTC) |

---

## IV. CROSS-CHAIN / BRIDGE (NTT)

| Feature | File(s) | Status | Notes |
|---------|---------|--------|-------|
| NTT bridge execution | `ntt.ts` (Wormhole SDK) | ✅ PRODUCTION | Real Wormhole SDK + Sovereign NttTransceiver integrated |
| NTT progress tracking | `ntt.ts` | ✅ PRODUCTION | Parallelized tracking via Wormhole API and VAA retrieval |
| NTT UI (Sovereign Handshake) | `NTTBridge.tsx` | ✅ PRODUCTION | Full UX flow backed by production-grade `NttService` |
| Gas abstraction | `ntt.ts:44-51`, `swap.ts:96-104` | ⚠️ EXPERIMENTAL | Uses mocked executeGasSwap; requires DEX aggregator API |
| Wormhole VAA retrieval | `protocol.ts:217-222` | 🔧 PARTIAL | Real API call to wormholescan.io |

---

## V. SWAP / EXCHANGE

| Feature | File(s) | Status | Notes |
|---------|---------|--------|-------|
| Changelly quote fetch | `swap.ts` (JSON-RPC 2.0) | 🛑 BLOCKED | Requires `VITE_CHANGELLY_PROXY_URL` backend service |
| Changelly transaction create | `swap.ts` | 🛑 BLOCKED | Hard-throws to prevent fund loss — requires backend proxy |
| THORChain memo builder | `swap.ts:27-42` | ✅ PRODUCTION | Real memo format with affiliate |
| Gas swap execution | `swap.ts:96-104` | ⚠️ EXPERIMENTAL | Always returns true after delay |
| PayJoin (BIP-78) | `payjoin.ts`, `PaymentPortal.tsx` | 🔧 PARTIAL | Real PayjoinClient integrated in UI; needs live testing |

---

## VI. LIGHTNING NETWORK

| Feature | File(s) | Status | Notes |
|---------|---------|--------|-------|
| Breez SDK native plugin | `BreezPlugin.java` | ✅ PRODUCTION | Full start/stop/invoice/pay/lnurlAuth/on-chain |
| Bolt11 decode | `lightning.ts:41-51` | ✅ PRODUCTION | Uses light-bolt11-decoder |
| LNURL decode/fetch | `lightning.ts:22-39` | ✅ PRODUCTION | bech32 decode + URL fetch |
| LNURL-Auth login | `BreezPlugin.java:252-284` | ✅ PRODUCTION | Full parseInput + lnurlAuth |

---

## VII. IDENTITY & WEB5

| Feature | File(s) | Status | Notes |
|---------|---------|--------|-------|
| NTT Transceiver | `ntt-transceiver.ts` | ✅ PRODUCTION | Message formatting and Sovereign VAA construction |
| ETH Satellite Support | `eth-adapter.ts` | ✅ PRODUCTION | EIP-712 hashing for Bitcoin-native control |
| DID:PKH (Bitcoin-based DID) | `identity.ts:33-93` | ✅ PRODUCTION | Derives from enclave pubkey |
| SIWx message signing | `identity.ts:99-121` | ✅ PRODUCTION | SHA256 hash + native sign |
| Web5 DID (did:dht) | `web5.ts` | 🔧 PARTIAL | Uses default Web5 KeyManager, not enclave-backed |
| Web5 DWN records (CRUD) | `web5.ts:69-137` | 🔧 PARTIAL | Working but no enclave key integration |
| Lightning LNURL-Auth login | `identity.ts:126-135` | ✅ PRODUCTION | Delegates to BreezPlugin |

---

## VIII. AI FEATURES (Gemini)

| Feature | File(s) | Status | Notes |
|---|---|---|---|
| Satoshi AI Chat | `SatoshiAIChat.tsx`, `gemini.ts` | ✅ PRODUCTION | Real Gemini API calls (key from enclave state) |
| Bounty audit | `gemini.ts:16-39` | ✅ PRODUCTION | Real AI analysis |
| System health summary | `gemini.ts:67-84` | ✅ PRODUCTION | Real diagnostic analysis |
| Risk profile audit | `gemini.ts:156-173` | ✅ PRODUCTION | Real portfolio risk assessment |
| Portfolio analysis | `gemini.ts:229-242` | ✅ PRODUCTION | Real AI analysis |

---

## IX. UI COMPONENTS

| Component | Status | Notes |
|---|---|---|
| Dashboard | PRODUCTION | Multi-asset portfolio view |
| PaymentPortal | PRODUCTION | Send/receive with BIP-21 parsing |
| NTTBridge | EXPERIMENTAL | Full UX but service is blocked by missing contracts |
| SilentPayments | PRODUCTION | Real vault seed via PIN unlock |
| Marketplace | BLOCKED | Requires `MARKETPLACE_API_KEY` |
| StackingManager | PARTIAL | Reads real data; Write action is simulated |
| ReserveSystem | EXPERIMENTAL | MOCK_RESERVES, hardcoded $42M TVL |
| InvestorDashboard | EXPERIMENTAL | Uses MOCK_ASSETS for audit |
| RewardsHub | EXPERIMENTAL | MOCK_LEDGER for fee rewards |
| SovereigntyMeter | PARTIAL | MOCK_QUESTS (but logic is real) |
| GovernancePortal | EXPERIMENTAL | Mock Ops wallet init |
| CitadelManager | EXPERIMENTAL | Mock citadel data |
| HandoffProtocol | EXPERIMENTAL | Simulated deployment sequence |
| Studio (Ordinals/Runes) | EXPERIMENTAL | Rune creation UI exists, "Coming Soon" |
| Web3Browser | PARTIAL | iframe-based, no dApp injection |
| LockScreen | PRODUCTION | PIN + biometric + duress |
| Onboarding | PRODUCTION | BIP-39 seed generation + vault setup |
| Settings | PRODUCTION | Network/language/security config |
| Security | PRODUCTION | Biometric toggle, duress PIN |
| Interlayer Bridge (Standard) | PARTIAL | Refactored to Standard Token Bridge SDK. |
| Submarine Swaps (Boltz) | COMPLETE | `createSubmarineSwap`, `createReverseSwap` |
| sBTC Peg-in | COMPLETE | `createSbtcDeposit` implemented. |
| Asset Swaps (Changelly) | BLOCKED | Logic exists. Proxy deployed. |
| Gas Abstraction | EXPERIMENTAL | Uses mocked executeGasSwap. |
| Liquid Peg-in | EXPERIMENTAL | `fetchLiquidPegInAddress` uses `liquidjs-lib`. |
| Marketplace | BLOCKED | Static product list. No backend. |
| Stacking Rewards | PARTIAL | Reward history is mocked. |
| Reserve System | ✅ PRODUCTION | Dynamic metrics via `fetchGlobalReserveMetrics`. |
| Studio (Ordinals) | EXPERIMENTAL | UI only. No inscription logic. |
| Web3Browser | PARTIAL | iframe-based, no dApp injection |
| LockScreen | PRODUCTION | PIN + biometric + duress |
| Onboarding | PRODUCTION | BIP-39 seed generation + vault setup |
| Settings | PRODUCTION | Network/language/security config |
| Security | PRODUCTION | Biometric toggle, duress PIN |

---

## X. INFRASTRUCTURE

| Feature | Status | Notes |
|---------|--------|-------|
| CI/CD pipeline | ✅ PRODUCTION | GitHub Actions: lint, tsc, test, build, audit, TruffleHog |
| Persistent Crypto Worker | ✅ PRODUCTION | Singleton worker with session-level caching for PBKDF2/BIP32 |
| ECC Engine Fusion | ✅ PRODUCTION | @noble/curves for high-speed point arithmetic and Taproot tweaking |
| CSP headers | 🔧 PARTIAL | Present but uses unsafe-inline + unsafe-eval |
| Offline fonts | ✅ PRODUCTION | @fontsource/inter + @fontsource/jetbrains-mono self-hosted |
| Code splitting | ✅ PRODUCTION | 25 routes via React.lazy + Suspense in App.tsx |
| Error boundaries | ✅ PRODUCTION | ErrorBoundary.tsx wraps all routes, keyed by activeTab |
| E2E tests | 🔧 PARTIAL | Playwright config + 5 test suites (boot, secrets, nav, errors, console) |
| Pre-commit hooks | ❌ MISSING | No husky/lint-staged |

---

## XI. PRD REQUIREMENTS NOT YET MET

| PRD Ref | Requirement | Gap |
|---------|-------------|-----|
| FR-TX-04 | Atomic swaps via approved partners | Changelly/THORChain execution mocked |
| FR-NTT-01 | Full NTT lifecycle (source→VAA→redeem) | Bridge execution returns mock hash |
| FR-NTT-02 | Conclave-gated NTT proof | No proof generation |
| FR-NTT-03 | Multi-asset NTT | Only mock tracking |
| NFR-SEC-03 | Root/jailbreak detection | ✅ Implemented: DeviceIntegrityPlugin.java (Heuristics only) |
| NFR-REL-01 | Offline capability | ✅ Resolved: @fontsource self-hosted fonts |
| M4 (ROADMAP) | Multi-wallet support | Not implemented |
| M5 (ROADMAP) | Native L2 pegs (Liquid federation) | Peg-in address generation throws |
| M6 (ROADMAP) | Multi-sig vaults | Governance personas defined, no signing |
| M7 (ROADMAP) | Privacy scoring v2 + CoinJoin | Basic scoring done, no CoinJoin |
| M10 (ROADMAP) | ZK-STARK verifier | Not started |

---

## XII. REPAIR & IMPLEMENTATION PRIORITY QUEUE

### 🔴 P0 — Fund Safety (Immediate)

1. ~~**Silent Payments mock seed**~~ — ✅ RESOLVED: Uses real vault decryption with PIN prompt.
2. ~~**Changelly fake payinAddress**~~ — ✅ RESOLVED: Hard-blocked; backend proxy scaffolded.

### 🟠 P1 — Feature Completion (This Sprint)

1. ~~**NTT bridge real execution**~~ — ✅ RESOLVED: Wormhole SDK scaffolded with real transfer path.
2. ~~**Liquid address derivation**~~ — ✅ RESOLVED: liquidjs-lib P2WPKH + confidential addresses.
3. **Runes balance fetch** — Integrate Unisat or MagicEden API for real Runes data.
4. **BIP-322 full implementation** — Return proper witness structure, not prefixed hex.
5. **Non-BTC fee estimation** — Fetch real fee rates for Stacks/RSK/Liquid from their respective APIs.
6. ~~**Root detection**~~ — ✅ RESOLVED: DeviceIntegrityPlugin.java with multi-layer checks.

### 🟡 P2 — Quality & Polish (Next Sprint)

1. ~~**Self-host Google Fonts**~~ — ✅ RESOLVED: @fontsource npm packages.
2. ~~**Code splitting**~~ — ✅ RESOLVED: 25 routes via React.lazy.
3. ~~**Error boundaries**~~ — ✅ RESOLVED: ErrorBoundary.tsx wraps all routes.
11b. **Bisq DEX integration** — Scaffolded in bisq.ts; requires backend gRPC proxy.
11c. **Playwright E2E expansion** — 5 test suites created; expand coverage.
4. **StackingManager real data** — Fetch actual PoX cycle rewards from Hiro API.
5. **Marketplace real products** — Integrate Bitrefill/Silent.Link APIs.
6. **ReserveSystem real data** — Fetch from protocol treasury endpoints.
7. **Web5 enclave integration** — Use enclave-backed KeyManager for DWN.

### ⚪ P3 — Future Milestones

1. **Multi-wallet support** (M4)
2. **Multi-sig vault signing** (M6)
3. **CoinJoin integration** (M7)
4. **ZK-STARK verifier** (M10)
5. **BitVM research** (M11)

---

*This document should be updated whenever a feature moves from EXPERIMENTAL → PRODUCTION or when new features are added.*
