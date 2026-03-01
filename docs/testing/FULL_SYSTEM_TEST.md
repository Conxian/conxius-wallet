# Full Wallet System Integration Testing

This document outlines the comprehensive E2E testing strategy for the Conxius Wallet, ensuring full ecosystem alignment and functional integrity.

## Overview

The "Full System Integration" test (located in `e2e/full_wallet_system.spec.ts`) simulates a complete user journey from first boot to advanced protocol interactions. This test runs in **Simulation Mode**, which bypasses real on-chain constraints while using high-fidelity mock data and real service logic where possible.

## Test Coverage

The suite verifies the following critical paths:

1.  **Onboarding & Enclave Initialization**
    *   Boot sequence and branding.
    *   Simulation mode selection.
    *   Hardware-level entropy gathering simulation.
    *   Secure Enclave PIN encryption and confirm.
    *   BIP-39 Master Seed backup and verification.
2.  **Funded State & Asset Discovery**
    *   Verification of "Funded" state (balances > 1M satoshis equivalent).
    *   Multi-layer asset display (Bitcoin, Stacks, Liquid, Phase 5 L2s).
3.  **Cross-Layer Navigation**
    *   **DeFi Enclave**: Liquidity pools and yield views.
    *   **NTT Bridge**: Wormhole integration and transceiver status.
    *   **Stacking (PoX)**: Real-time APY estimation and stacking status.
    *   **Governance (Senate)**: Proposal voting and council participation.
    *   **Labs Discovery**: BitVM and ZK-STARK verification.
4.  **Transaction Lifecycle**
    *   Address entry and validation.
    *   Fee estimation and review.
    *   Signing and "Broadcast" simulation.
5.  **Security & Session Management**
    *   TEE-backed session locking.
    *   Vault unlocking via PIN.

## Running the Tests

To run the full system integration test suite:

```bash
# Run all E2E tests
pnpm test:e2e

# Run specifically the full system test
pnpm playwright test e2e/full_wallet_system.spec.ts

# Run with UI for debugging
pnpm test:e2e:ui
```

## Maintenance

*   **Funded State**: The funded state is controlled via `MOCK_ASSETS` in `constants.tsx`.
*   **Navigation**: The test uses a `navigateTo` helper that handles both Desktop (Sidebar) and Mobile (Bottom Nav + Menu) viewports.

---
*Last Updated: 2026-02-18*
