# Conxius Wallet: Project Context

**Last Updated:** 2026-03-07
**Context:** Phase 4 "Clean Break" Native Migration Complete (v1.6.0)

---

## 🛡️ The Citadel (Mobile Core)

Conxius is a pure-native Android, TEE-backed sovereign interface for the Full Bitcoin Ecosystem (BTC, L2, Sidechains, RGB, Ark, BitVM). It handles all private key operations within the "Conclave" using Kotlin and Jetpack Compose.

## 🚀 The Gateway (B2B Expansion)

The **Conxian Gateway** is the institutional expansion layer for Conxius. It is a standalone web app that provides:

- **Corporate Treasury**: Advanced DEX and liquidity management.
- **B2B Shielded Payments**: Privacy-focused enterprise transactions.
- **Institutional Launchpad**: Token issuance for businesses.

---

## 🔍 Context Refresh & Alignment (2026-03-07)

A comprehensive migration from Capacitor to a pure Kotlin/Jetpack Compose architecture has been completed, fulfilling the "Clean Break" (Phase 4) roadmap.

- **Status**: **Fully Native**. All Java/Capacitor dependencies have been replaced or migrated to Kotlin.
- **Android Build**: Verified with Gradle 8.4.2, AGP 8.4.2, and Java 21.
- **Core Native Modules**:
  - `:core-crypto`: StrongBox-backed AES-GCM-256 and EphemeralSeed.
  - `:core-bitcoin`: BDK Kotlin integration (v0.30.0) with NWC, DLC, and Babylon stubs.
  - `:core-database`: Encrypted Room database via SQLCipher.
  - `:app`: Jetpack Compose UI with Material 3 and biometric gating.
- **Verification**: All modules compile and pass basic JUnit and instrumentation tests.

---

## 🧪 Technical State (v1.6.0)

- **UI Framework**: Jetpack Compose (Kotlin).
- **Security**: StrongBox (TEE), BiometricPrompt, SecureEnclave.
- **Hardening**: Zero Secret Egress and memory zeroing (.fill(0)) implemented in all native modules.
- **Protocols**: Full support for L1 (via BDK), with native stubs for NWC, DLC, and Babylon.
- **Targeting**: Android API 35 (Vanilla Ice Cream) for maximum security and performance.

---

*Precision is non-negotiable. Sovereignty is the goal.*
