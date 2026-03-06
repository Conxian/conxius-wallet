---
title: Full System Integration Testing
layout: page
permalink: /docs/full-system-test
---

# Full Wallet System Integration Testing

This document outlines the comprehensive E2E testing strategy for the Conxius Wallet, ensuring full ecosystem alignment and functional integrity.

## Overview

We utilize a multi-layered testing approach to verify the security, performance, and functionality of the Conxius Wallet across all supported Bitcoin layers and services.

## 1. Unit Testing (Vitest 4.0)

- **Scope:** Core logic, utility functions, and cryptographic primitives.
- **Location:** `/tests`
- **Command:** `pnpm test`
- **Key Suites:**
    - `tests/enclave-storage.test.ts`: TEE/StrongBox abstraction verification.
    - `tests/ai-security.test.ts`: Redaction and sanitization logic.
    - `tests/stacks-bridge.test.ts`: Clarity 4.0 contract interaction.

## 2. E2E Functional Testing (Playwright)

- **Scope:** Cross-chain user flows, onboarding, and UI state consistency.
- **Location:** `/e2e`
- **Command:** `pnpm test:e2e`
- **Strategy:** Uses the unified `e2e/full_system_strict.spec.ts` for strict functional validation.

## 3. Native Plugin Verification

- **Scope:** Kotlin native plugins (SecureEnclave, DeviceIntegrity, NativeCrypto).
- **Location:** `android/app/src/test/` and `tests/protocol-alignment.test.ts`.
- **Command:** `./gradlew test` (within `android` directory).

## 4. Manual Verification (Real Devices)

- **Scope:** Hardware-specific features (StrongBox, Biometrics) and performance on Tier 2 devices.
- **Checklist:**
    - Biometric auth prompt appears and functions.
    - StrongBox key generation succeeds on supported hardware.
    - Lightning node sync completes on mobile network.

## 5. Continuous Integration (GitHub Actions)

Every Pull Request triggers a full suite of checks:
- **Lint:** `pnpm run lint`
- **Build:** `pnpm run build`
- **Test:** `pnpm test`
- **E2E:** `pnpm test:e2e`
- **Android:** `cd android && ./gradlew assembleDebug`
