# Conxius Wallet: AI Agent Guide

Welcome, Sovereign Agent. This document provides instructions and context for working with the Conxius Wallet codebase.

## 🛡️ Core Principles

1.  **Sovereign by Design**: Always prioritize user sovereignty and privacy.
2.  **Zero Secret Egress**: Never log, transmit, or expose private keys or mnemonics.
3.  **Local-First**: Prefer on-device solutions (Android Keystore, local storage) over cloud dependencies.
4.  **Truthful Shipping**: Ensure features are fully implemented to standard before marking them as "production ready".

## 🏗️ Architecture Overview

Conxius is an Android-first wallet built using:
-   **Frontend**: React + Vite + Tailwind CSS v4.
-   **Native Layer**: Capacitor for Android integration.
-   **Secure Enclave**: A native Android plugin (`SecureEnclavePlugin.java`) that uses the Android Keystore (AES-GCM) for hardware-level security.
-   **Bitcoin Logic**: `bitcoinj` (pinned to 0.16.3) and `conxius_core` (native Rust library).

### Key Directories
-   `/components`: React UI components.
-   `/services`: Core logic (signing, protocol adapters, storage).
-   `/android`: Capacitor Android project.
-   `/docs`: Extended documentation (PRD, Whitepaper, Analysis).

## 🛠️ Build & Development

### Frontend
-   **Install Dependencies**: `npm install`
-   **Run Dev Server**: `npm run dev` (Port 3000)
-   **Build Production**: `npm run build`

### Android
-   **Sync Capacitor**: `npx cap sync`
-   **Build Android**: `cd android && ./gradlew assembleDebug`
-   **Run Unit Tests**: `cd android && ./gradlew :app:testDebugUnitTest`

## 🧪 Testing

### Frontend Tests
Run Vitest unit tests for the frontend logic:
```bash
npm test
```

### Security Checks
Before submitting any change that handles sensitive data:
1.  Verify that `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, and `spellCheck="false"` are set for all sensitive input fields.
2.  Ensure no secret material is being logged.
3.  Verify that the Android `FLAG_SECURE` is active in `MainActivity.kt`.

## 📜 Documentation Maintenance

When updating the repo, ensure the following files are synchronized:
-   `Sovereign_State.md`: Tracks overall project readiness.
-   `Business_State.md`: Tracks business architecture status.
-   `CHANGELOG.md`: Documents all notable changes.
-   `ROADMAP.md`: Aligns technical milestones with business goals.
-   `RISK_REGISTRY.md`: Core legal defense and risk assessment.
-   `MONETIZATION.md`: Revenue strategy (SaaS & Affiliates).
-   `PARTNERS_AND_COMPLIANCE.md`: Approved third-party vendor stack.

## 🤝 Pre-Commit Hook

Always call the `pre_commit_instructions` tool before submitting. Follow its instructions to ensure proper testing, verification, and reflection.
