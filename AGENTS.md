---
title: AI Agent Guide
layout: page
permalink: /agents
---

# Conxius Wallet: AI Agent Guide

Welcome, Sovereign Agent. This document provides instructions and context for
working with the Conxius Wallet codebase and its B2B enhancement, the Conxian
Gateway.

**Last Updated:** 2026-03-12
**Context:** B2B Alignment & Native Bridge (v1.6.0)

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

- `/components`: 38 React UI components.
- `/services`: Core business logic (32 modules).
- `/android`: Native Android project (Phase 4/5 Native Migration).
- `/conxian-gateway`: (Sub-project) The Conxian Gateway enhancement.
- `/lib-conxian-core`: (Sub-project) Shared Rust/TS core library.

---

## 🧪 Testing Guidelines

### Standards

```bash
# Frontend Tests
pnpm test

# Android Tests
cd android && ./gradlew :app:testDebugUnitTest
```

---

## 📜 Documentation Maintenance

Ensure the following files are synced:

- `docs/archive/PROJECT_CONTEXT.md`: Current state and session notes.
- `docs/business/PRD.md`: The high-authority source of truth (v1.6.0).
- `docs/operations/ROADMAP.md`: Technical and business milestones.
- `docs/protocols/IMPLEMENTATION_REGISTRY.md`: Feature-level status (v1.6.0).

---

## 🚀 Native Bridge Alignment (v1.6.0)

The wallet utilizes a **Bridged Sovereign Architecture** where native Kotlin
managers handle security-critical signing and protocol coordination.

- **Native Managers**: Located in `com.conxius.wallet.bitcoin`.
- **Managers**: `BdkManager`, `BabylonManager`, `NwcManager`, `DlcManager`,
  `ArkManager`, `StateChainManager`, `MavenManager`, `LiquidManager`,
  `EvmManager`, `LightningManager`.
- **Signing**: All final signatures MUST be routed through the native enclave
  via `WalletViewModel` or `SecureEnclavePlugin`.

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
