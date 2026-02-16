# Conxius Wallet: Project Context

**Last Updated:** 2026-02-18
**Context:** Full Repo Maintenance Protocol Completed

---

## 🛡️ The Citadel (Mobile Core)

Conxius is an Android-first, TEE-backed sovereign interface for the Full Bitcoin Ecosystem (BTC, L2, Sidechains, RGB, Ark, BitVM). It handles all private key operations within the "Conclave."

## 🚀 The Gateway (B2B Expansion)

The **Conxian Gateway** is the institutional expansion layer for Conxius. It is a standalone web app that provides:

- **Corporate Treasury**: Advanced DEX and liquidity management.
- **B2B Shielded Payments**: Privacy-focused enterprise transactions.
- **Institutional Launchpad**: Token issuance for businesses.

---

## 🔧 Maintenance Protocol (Completed 2026-02-18)

A comprehensive repository maintenance protocol was executed to align with GitHub best practices and ensure code quality:

- **Documentation**:
  - Created `.github` issue and PR templates.
  - Added `SECURITY.md` and `CODE_OF_CONDUCT.md`.
  - Enhanced `README.md` with architecture diagrams and status badges.
- **Quality Control**:
  - Configured **ESLint 10** with React and TypeScript support.
  - Fixed critical **React Hook violations** in `Dashboard.tsx`.
  - Removed deprecated artifacts and backup files (`BreezPlugin.java.bak`, etc.).
- **Verification**:
  - All **145+ tests** passed (Vitest).
  - Dependency audit and `pnpm` lockfile synchronization.

### 📱 Android Build & Device Verification (2026-02-18)

- **Build Environment**: Fixed `JAVA_HOME` compatibility (Downgraded Capacitor plugins to Java 17).
- **Native Layer**: 
  - Reverted `MainActivity` to Java to resolve `ClassNotFoundException`.
  - Configured `build.gradle` for correct dependency resolution (Biometrics, Capacitor).
- **Device Status**: Verified installation and startup on **Samsung Galaxy A10 (SM-A105F)**.
- **Logs**: Confirmed `DeviceIntegrity` and `SecureEnclave` plugin registration without runtime crashes.

---

## 🧪 Technical State

- **Frontend**: React 19 + Vite 7 + Tailwind 4.
- **Native**: SecureEnclavePlugin (TEE), BreezPlugin (Lightning).
- **Hardening**: Zero-Leak memory enforcement (.fill(0)) in all cryptographic modules.
- **Protocols**: Full support for L1, Lightning, Stacks, Liquid, RSK, BOB, RGB, Ark, BitVM, State Chains, Maven.

---

*Precision is non-negotiable. Sovereignty is the goal.*
