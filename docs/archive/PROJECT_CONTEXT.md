# Conxius Wallet: Project Context

**Last Updated:** 2026-03-12
**Context:** Phase 4/5 Native Migration Complete (v1.6.0)

---

## 🛡️ The Citadel (Mobile Core)

Conxius is a native Android, TEE-backed sovereign interface for the Full Bitcoin Ecosystem (BTC, L2, Sidechains, RGB, Ark, BitVM, Maven). It handles all private key operations within the "Conclave" using Kotlin and Jetpack Compose.

## 🚀 The Gateway (B2B Expansion)

The **Conxian Gateway** is the institutional expansion layer for Conxius. It is a standalone web app that provides:

- **Corporate Treasury**: Advanced DEX and liquidity management.
- **B2B Shielded Payments**: Privacy-focused enterprise transactions.
- **Institutional Launchpad**: Token issuance for businesses.

---

## 🔍 Context Refresh & Alignment (2026-03-12)

A comprehensive migration to a **Bridged Sovereign Architecture** has been completed, fulfilling the "Clean Break" (Phase 4) roadmap and preparing for Phase 5.

- **Status**: **Fully Bridged Native**. All security-critical logic resides in the Kotlin layer, while high-level protocol logic is handled in a secure TypeScript layer.
- **Android Build**: Verified with Gradle 8.4.2, AGP 8.4.2, and Java 21.
- **Core Native Modules**:
  - `:core-crypto`: StrongBox-backed AES-GCM-256 and EphemeralSeed.
  - `:core-bitcoin`: BDK Kotlin integration (v0.30.0) with a full suite of Native Bridge Managers (Babylon, DLC, NWC, Ark, StateChain, Maven, Liquid, EVM, Lightning).
  - `:core-database`: Encrypted Room database via SQLCipher.
  - `:app`: Jetpack Compose UI with Material 3 and biometric gating.
- **Verification**: All modules compile and pass basic JUnit and instrumentation tests.

---

## 🧪 Technical State (v1.6.0)

- **UI Framework**: Jetpack Compose (Kotlin) + React (Bridged).
- **Security**: StrongBox (TEE), BiometricPrompt, SecureEnclave.
- **Architecture**: Bridged Sovereign (Native Enclave + TS Protocol Layer).
- **Hardening**: Zero Secret Egress and memory zeroing (.fill(0)) implemented in all native modules.
- **Protocols**: Full ecosystem support via Native Bridge Managers.
- **Targeting**: Android API 35 (Vanilla Ice Cream) for maximum security and performance.

---

*Precision is non-negotiable. Sovereignty is the goal.*
