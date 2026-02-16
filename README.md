---
title: Conxius Wallet
layout: page
permalink: /
---

# Conxius Wallet: The Sovereign Citadel for the Bitcoin Ecosystem

### **Hardware-level security without the dongle.**

Conxius is the ultimate "Bitcoin-First" mobile interface, engineered to provide native, TEE-protected access to the entire Bitcoin stack. From L1 savings and Lightning payments to Stacks DeFi, Liquid sidechains, and RGB assets—Conxius is your single point of sovereignty.

---

## ⚡ 5-Second Value Proposition

*   **Secure by Design:** Private keys are locked in Android's **StrongBox/TEE (The Conclave)**. They never leave the hardware.
*   **Unified Sovereignty:** One app for BTC (Taproot/SP), Lightning, Stacks (sBTC), Liquid, BOB, RSK, RGB, Ordinals, and Runes.
*   **Zero-Friction Interop:** Move assets between layers using the **Sovereign NTT Bridge** with built-in gas abstraction.
*   **Privacy First:** Native Tor integration, Silent Payments, and AI-powered privacy scoring.

---

## 🛠️ Ecosystem Core (The Conclave)

Conxius is more than a wallet; it's a security paradigm. It leverages a singleton **Persistent Crypto Worker** and a native **SecureEnclavePlugin** to ensure that sensitive operations occur in an isolated environment, even when the UI is active.

### Supported Layers & Protocols:
*   **Bitcoin L1:** Native Segwit (BIP-84), Taproot (BIP-86), Silent Payments (BIP-352).
*   **Layer 2s:** Stacks (Nakamoto/sBTC), BOB (Build On Bitcoin), Rootstock (RSK).
*   **Sidechains:** Liquid (L-BTC).
*   **Assets:** Ordinals, Runes, BRC-20, RGB (Client-side validation).
*   **Interoperability:** Wormhole NTT, Boltz Swaps, THORChain.
*   **Future Tech:** BitVM (On-device verifier), Ark (VTXOs), State Chains.

---

## 🚀 Getting Started

**Prerequisites**
*   Node.js (v20+)
*   Android Studio + SDK (for TEE/StrongBox verification)
*   Java 21+

**Quick Install**
```bash
pnpm install
pnpm run dev # Launches with Mock Enclave for web testing
```

**Android Production Build**
```bash
npx cap sync android
cd android && ./gradlew :app:installDebug
```

---

## 📊 Performance Benchmarks (Vitest 4.0)

| Metric | Result |
| :--- | :--- |
| **Total Tests** | 138 |
| **Passed** | 138 |
| **Duration** | 3.12s |
| **Security Layer** | Android StrongBox / TEE |

---

## 📂 Strategic Documentation

*   [**ROADMAP.md**](ROADMAP.md) - Operational Levels & Marketing Alignment.
*   [**MONETIZATION.md**](MONETIZATION.md) - The Sovereign Revenue Model.
*   [**RISK_REGISTRY.md**](RISK_REGISTRY.md) - BitcoinLayers.org Compliance Audit.
*   [**PRD.md**](PRD.md) - Full Technical & Business Specifications.

---

## 🤝 Partners & Compliance

Conxius is strictly non-custodial. We partner with regulated entities (**Transak, VALR, Changelly**) to provide seamless fiat-to-sovereignty on-ramps without ever touching user funds.

