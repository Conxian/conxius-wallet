---
title: AI Agent Guide
layout: page
permalink: /agents
---

# Conxius Wallet: AI Agent Guide

Welcome, Sovereign Agent. This document provides instructions and context for working with the Conxius Wallet codebase and its B2B enhancement, the Conxian Gateway.

**Last Updated:** 2026-02-15
**Context:** B2B Alignment (Conxius Wallet + Conxian Gateway)

---

## 🛡️ Core Principles

1. **Sovereign by Design**: Always prioritize user sovereignty and privacy.
2. **B2B Alignment**: Recognize **Conxian Gateway** as the institutional expansion layer for **Conxius Wallet**.
3. **Zero Secret Egress**: Never log, transmit, or expose private keys or mnemonics.
4. **Local-First**: Prefer on-device solutions (Android Keystore) over cloud dependencies.
5. **Non-Custodial**: Conxian Labs never possesses, manages, or controls user funds.

---

## 🏗️ Ecosystem Architecture

### Conxius Wallet (The Citadel)
- **Role**: Mobile core, TEE-backed private key management.
- **Security**: Android Keystore AES-GCM-256, BiometricPrompt, StrongBox.
- **Protocol Support**: BTC, STX, RBTC, Liquid, Nostr, Web5, BOB, RGB, Ordinals, Runes, Ark, BitVM.

### Conxian Gateway (B2B Enhancement)
- **Role**: Institutional portal for corporate treasury, launches, and shielded payments.
- **Tech**: Next.js (Static Export), Stacks.js.
- **Integration**: Featured in Sovereign Browser; compatible with Corporate Profiles.

---

## 📁 Key Directories (Conxius)

- `/components`: 38 React UI components.
- `/services`: Core business logic (32 modules).
- `/android`: Capacitor Android project.
- `/conxian-ui`: (Sub-project) The Conxian Gateway enhancement.

---

## 🧪 Testing Guidelines

### Standards
```bash
# Frontend Tests
npm test

# Android Tests
cd android && ./gradlew :app:testDebugUnitTest
```

### B2B Security Checks
1. Verify Corporate Profile data is always encrypted.
2. Ensure session handshakes between mobile and Gateway are secure.
3. Confirm "Shielded Wallet" interactions in Gateway adhere to enclave standards.

---

## 📜 Documentation Maintenance

Ensure the following files are synced:
- `PROJECT_CONTEXT.md`: Current state and session notes.
- `PRD.md`: The high-authority source of truth.
- `ROADMAP.md`: Technical and business milestones.
- `IMPLEMENTATION_REGISTRY.md`: Feature-level status.

---

*Remember: We are building institutional-grade sovereign infrastructure. Precision is non-negotiable.*

---

## 🚀 Full Bitcoin Ecosystem Alignment (2026-02-16)

The wallet has been expanded to support the full Bitcoin stack. When working on any module:
- Ensure it respects the specific derivation paths in `services/signer.ts`.
- Use the established protocol fetchers in `services/protocol.ts`.
- Maintain 'Zero-Leak' memory hardening (`.fill(0)`).
- Prioritize TEE/StrongBox enforcement for all new layers.
