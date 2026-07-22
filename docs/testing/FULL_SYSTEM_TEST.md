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
    - `tests/enclave-storage.test.ts`: Android Keystore/TEE/StrongBox storage abstraction verification; this does not prove device-specific StrongBox backing.
    - `tests/ai-security.test.ts`: Redaction and sanitization logic.
    - `tests/stacks-bridge.test.ts`: Clarity 4.0 contract interaction.

## 2. E2E Functional Testing (Playwright)

- **Scope:** Cross-chain user flows, onboarding, and UI state consistency.
- **Location:** `/e2e`
- **Command:** `pnpm test:e2e`
- **Strategy:** Uses the unified `e2e/full_system_strict.spec.ts` for strict functional validation.

## 3. Native Plugin Verification

- **Scope:** Kotlin native plugins (SecureEnclave, DeviceIntegrity, NativeCrypto),
  the KeyMint authorization policy/evidence boundary, and the Play Integrity
  opaque-token client boundary.
- **Location:** `android/app/src/test/` and `tests/protocol-alignment.test.ts`.
- **Command:** `./gradlew test` (within `android` directory).

JVM/unit tests cover deterministic policy, canonical binding, and client
pass-through behavior only. They do not qualify hardware, Android Key Attestation
chains, Play installation state, server verdict verification, replay/freshness,
or production value-operation enforcement. See the [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md).

## 4. Manual Verification (Real Devices)

- **Scope:** Hardware-specific features (StrongBox, Biometrics) and performance on Tier 2 devices.
- **Checklist:**
    - Biometric auth prompt appears and functions.
    - StrongBox key generation and explicit security-level evidence are captured on supported hardware.
    - TEE-only, API 26–30 legacy, unsupported, Play-installed, and relevant non-Play states are captured with expected fail-closed outcomes.
    - Android Key Attestation chain/root/revocation/challenge/app identity/security-level/boot/patch checks pass on the backend.
    - Play Integrity server verification matches package, signing certificate, canonical request hash, timestamp, and required verdict policy.
    - Durable operation freshness/replay and centralized value-operation gate negative tests pass.
    - Rollout, rollback, telemetry minimization, and verifier/Play outage procedures are exercised.
    - Lightning node sync completes on mobile network.

## 5. Continuous Integration (GitHub Actions)

Every Pull Request triggers a full suite of checks:
- **Lint:** `pnpm run lint`
- **Build:** `pnpm run build`
- **Test:** `pnpm test`
- **E2E:** `pnpm test:e2e`
- **Android:** `cd android && ./gradlew :app:testDebugUnitTest`

Hosted CI coverage is not a substitute for the real-device and backend
qualification matrix. No test result in this document authorizes a claim that
protocol signing is hardware-qualified.
