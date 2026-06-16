# FDC3 Interoperability Proposal (v1.0)

**Date:** 2026-06-15
**Status:** PROPOSAL
**Issue:** CON-1181

## 1. Executive Summary
This proposal defines the path for Conxius Wallet and Conxian Gateway to align with the **FDC3 (Financial Desktop Connectivity and Interoperability)** standard. By adopting FDC3, we enable seamless data exchange and intent-based collaboration with enterprise financial desktops (OpenFin, Glue42) and institutional treasury workflows.

## 2. Core Intents for Conxian
- **`ViewAsset`**: Display real-time data for a specific Bitcoin layer asset (sBTC, L-BTC, RGB).
- **`InitiateSettlement`**: Trigger an X402 settlement path via the Conxian Gateway.
- **`SignPayload`**: Raise an intent for the Conxius Wallet to sign a hardware-isolated payload.
- **`ViewTransaction`**: Navigate to a specific transaction audit record in the Gateway.

## 3. Context Objects
- **`fdc3.instrument`**: Mapping Bitcoin assets (BTC, STX, etc.) to standard financial instruments.
- **`conxian.settlement_intent`**: Custom context for X402 settlement metadata (invoice, trust-tier, network).
- **`conxian.signer_request`**: Custom context for enclave-backed signing requests.

## 4. Implementation Strategy
- **Gateway Interop**: Implement an FDC3 Desktop Agent bridge within the Conxian Gateway to handle intents raised by external apps.
- **UI Interop**: Enable Conxian UI to raise intents (e.g., `ViewAsset`) when users interact with financial data.
- **Local-First Resolver**: Use `fdc3.raiseIntentForContext` to allow users to pick the preferred signer or explorer for a given context.

## 5. Next Steps
- Define the `conxian.settlement_intent` JSON schema in `packages/schemas`.
- Prototype the `ViewAsset` intent handler in the Admin Dashboard Core-Shell.
