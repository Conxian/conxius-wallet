# Conxius Wallet: AI Agent Guide

Welcome, Sovereign Agent. This document provides instructions and context for
working with the Conxius Wallet codebase and its B2B enhancement, the Conxian
Gateway.

**Last Updated:** 2026-06-30
**Context:** Production Operational State (v1.9.5) — COO Alignment Complete

---

## 🛡️ Core Principles

1. **Sovereign by Design**: Always prioritize user sovereignty and privacy.
2. **B2B Alignment**: Recognize **Conxian Gateway** as the institutional
   expansion layer for **Conxius Wallet**.
3. **Zero Secret Egress**: Never log, transmit, or expose private keys or mnemonics.
4. **Local-First**: Prefer on-device solutions (Android Keystore) over cloud dependencies.
5. **Non-Custodial**: Conxian Labs never possesses, manages, or controls user funds.

---

## 🏗️ Ecosystem Architecture

### Conxius Wallet (The Citadel)

- **Role**: Mobile core, TEE-backed private key management.
- **Security**: Android Keystore AES-GCM-256, BiometricPrompt, StrongBox.
- **Architecture**: **Bridged Sovereign** (Native Enclave + TS Protocol Logic).
- **Protocol Support**: BTC, STX, RBTC, Liquid, Nostr, Web5, BOB, RGB, Ordinals,
  Runes, Ark, BitVM, Maven, StateChain.

### Conxian Gateway (B2B Enhancement)

- **Role**: Institutional portal for corporate treasury, launches, and shielded
  payments.
- **Tech**: Next.js (Static Export), Stacks.js.
- **Integration**: Featured in Sovereign Browser; compatible with Corporate Profiles.

---

## 📁 Key Directories (Conxius)

- `/components`: React UI components.
- `/services`: Core business logic (32 modules including fdc3.ts, trust-policy.ts).
- `/android`: Native Android project (Native Migration complete).
- `/core`: Core TypeScript modules.
- `/contracts`: Clarity smart contracts.
- `/docs`: Operational, architectural, and state documentation.
- `/tests`: Vitest unit + Playwright e2e tests (50+ test files).
- `/e2e`: End-to-end Playwright specs.
- `/openspec`: OpenSpec change proposals and tracking.
- `/scripts`: CI and build scripts.

---

## 🧪 Testing Guidelines

### Standards

```bash
# Frontend Tests
pnpm test

# Android Tests
cd android && ./gradlew :app:testDebugUnitTest

# Run Conxian Baseline Hygiene Scanner (automates Baseline Review checks)
python3 scripts/ci/baseline_hygiene_scanner.py
```

---

## 📜 Documentation Maintenance

Ensure the following files are synced:

- `docs/archive/PROJECT_CONTEXT.md`: Current state and session notes.
- `docs/business/PRD.md`: The high-authority source of truth (v1.9.5).
- `docs/state/Business_State.md`: Business alignment and market fit.
- `docs/state/Sovereign_State.md`: Technical implementation status.
- `docs/operations/ROADMAP.md`: Technical and business milestones.
- `docs/protocols/IMPLEMENTATION_REGISTRY.md`: Feature-level status (v1.9.5).

---

## 📋 Operating Model & Approvals

All "High" and "Urgent" issues require COO review before promotion to \`main\`.
See [docs/operations/OPERATING_MODEL.md](docs/operations/OPERATING_MODEL.md) for the canonical approval path.

### Branch Hygiene (2026-06-30 COO Alignment)

On 2026-06-30, 13 stale branches were archived after COO review. All represented
work that was superseded by direct-to-main merges (PRs #307–#351). Main already
contains better implementations (e.g., `ProductionRuntimeGuard.failClosed()` for
fail-closed enforcement across all native managers).

Key artifacts preserved from branches:
- `.jules/cxn-arch-guardian.md` — security vulnerability journal
- `.jules/sentinel.md` — security sentinel learnings
- `.vscode/extensions.json` — recommended VS Code extensions

### Security Journal

The `.jules/` directory contains a hardening journal documenting discovered
vulnerabilities, root causes, and prevention patterns. Reference these before
implementing new security-sensitive code paths.

## Protocol Coverage — SDK → Wallet Alignment

The Conxius Enclave SDK (`conxius-enclave-sdk` v2.0.17) defines the canonical **42-chain AssetRegistry** and **52 protocol modules** (24 blockchain + 28 infrastructure). The wallet must provide user-facing protocol support for every chain where Conxian users hold or transact assets.

### Native Manager → SDK Chain Map

| Native Manager | SDK Chain | Status | Notes |
|---------------|-----------|--------|-------|
| `BdkManager` | Bitcoin | ✅ Production | BDK wallet core |
| `LightningManager` | Lightning | ✅ Production | LND/Breez integration |
| `LiquidManager` | Liquid | ✅ Production | Elements/Liquid |
| `BabylonManager` | Babylon | ✅ Production | BTC staking |
| `DlcManager` | DLC | ✅ Production | Discreet Log Contracts |
| `ArkManager` | Ark | ✅ Production | Ark protocol |
| `EvmManager` | Ethereum + 20 L2s | ✅ Production | EVM-compatible chains |
| `NwcManager` | Lightning (NWC) | ✅ Production | Nostr Wallet Connect |
| `StateChainManager` | StateChain | ✅ Production | Mercury StateChain |
| `MavenManager` | Maven | ✅ Production | Maven protocol |
| `BreezManager` | Lightning | ✅ Production | Breez SDK |
| `YieldManager` | Multi-chain | ✅ Production | Yield aggregation |

### TypeScript Protocol Services

| Service | SDK Module | Status |
|---------|-----------|--------|
| `services/bitvm.ts` | bitvm | ✅ Active |
| `services/ntt.ts` | NTT rail | ✅ Active |
| `services/lightning.ts` | lightning | ✅ Active |
| `services/wormhole-signer.ts` | Wormhole rail | ✅ Active |
| `services/web5.ts` | identity | ✅ Active |
| `services/gemini.ts` | AI/automation | ✅ Active |
| `services/eth-adapter.ts` | ethereum | ✅ Active |
| `services/signer.ts` | musig2/frost | ✅ Active |
| `services/ai-security.ts` | security | ✅ Active |

### Protocol Gap Analysis — Wallet

| SDK Protocol | Wallet Status | Priority | Notes |
|-------------|--------------|----------|-------|
| RGB | ❌ No manager | P2 | RGB asset display/send |
| Fedimint | ❌ No manager | P2 | Fedimint ecash |
| Citrea | ❌ No manager | P3 | ZK-rollup assets |
| Strata | ❌ No manager | P3 | Strata assets |
| Rootstock | ⚠️ Via EVM | P3 | RBTC via EVM manager |
| BOB | ⚠️ Via EVM | P3 | BOB via EVM manager |
| Botanix | ❌ No manager | P3 | Spiderchain |
| Mezo | ❌ No manager | P3 | Bitcoin L2 |
| Solana | ❌ No manager | P2 | Solana via Wormhole |
| Nostr | ✅ `services/web5.ts` | Done | Nostr integration |
| Web5 | ✅ `services/web5.ts` | Done | TBDex/Web5 |
| Ordinals | ❌ No manager | P2 | Ordinal display |
| Runes | ❌ No manager | P2 | Rune tokens |
| BIP-353 | ✅ DNS resolver | Done | Human-readable payments |
| x402 | ❌ No manager | P3 | Open payments |

## 🚀 Native Bridge Alignment (v1.9.5)

The wallet utilizes a **Bridged Sovereign Architecture** where native Kotlin
managers handle security-critical signing and protocol coordination.

- **Native Managers**: Located in `com.conxius.wallet.bitcoin`.
- **Managers**: `BdkManager`, `BabylonManager`, `NwcManager`, `DlcManager`,
  `ArkManager`, `StateChainManager`, `MavenManager`, `LiquidManager`,
  `EvmManager`, `LightningManager`, `BreezManager`, `YieldManager`.
- **Signing**: All final signatures MUST be routed through the native enclave
  via `WalletViewModel` or `SecureEnclavePlugin`.

## 🔐 SDK Integration (Session 47 — Aug 2026)

### Enclave SDK Path

The `conxius-silent-payments` Rust crate (`native/silent-payments/`) has an
optional `enclave` feature gate for hardware-backed signing through
`conxius-enclave-sdk`. Enable in production builds:

```toml
[dependencies]
conxius-silent-payments = { features = ["enclave"] }
```

When enabled, the crate re-exports:
- `EnclaveManager` — Android StrongBox operations
- `SignRequest` / `SignResponse` — enclave signing primitives
- `AttestationReport` — hardware attestation verification
- `ReplayGuard` — nonce replay protection
- `musig2` — MuSig2 multisig protocol
- `bitcoin` — Bitcoin protocol primitives

### JNI Integration Path

The Android JNI layer (`native/silent-payments-jni/`) is the next target for
enclave integration. Route key operations through `silent_payments::EnclaveManager`
before calling `silent_payments::scan_transaction`.

### Current Branch

Enclave changes are on `feat/enclave-sdk-wiring`. Merge to main after JNI
integration is complete and tested on API 28+ devices.

## 🤖 Sovereign AI & Zero-Leak Privacy

Conxius implements a strict AI security layer to ensure no sensitive
cryptographic identifiers leave the device.

- **Sanitization**: Outgoing prompts are audited via `services/ai-security.ts`.
- **Security**: Normalization strips ZWCs to prevent obfuscation bypasses.

---

*Remember: We are building institutional-grade sovereign infrastructure. Precision
is non-negotiable.*

## 🎨 UI/UX Standardization (Sovereign Earthy)

All primary operational views MUST follow the Conxian "Bright Foundation":

- **Base Canvas**: Ivory (#FDFBF7) or Warm Off-White (#F9F8F6).
- **Surface Layers**: White (#FFFFFF) for cards, modals, and sections.
- **Typography**: High-contrast Dark Earth/Deep Black (#121212, #1A1A1A).
- **Brand Accents**: Earthy tones (#C25E00) and Forest Greens (#1E3A34) reserved for primary CTAs and active states.
- **Legibility**: Maintain WCAG AAA compliance for financial data (Dark text on Light backgrounds).
- **Purge**: Avoid heavy dark-mode backgrounds in functional workspaces. Hero zones may use deep brand colors for presence.
