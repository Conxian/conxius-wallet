---
title: "Wasm-First Gateway Strategy"
status: PROPOSAL
date: 2026-06-15
issue: CON-1217
---

# [Phase 7] Wasm-First Gateway Strategy

## Executive Summary
To achieve true "Local-First" sovereign verification, Conxian is transitioning performance-critical and verification-heavy logic from native Rust environments to WebAssembly (Wasm). This enables identical verification code to run across Browser (Web), Mobile (React Native/WebView/Native), and Server (Node.js/Edge) environments.

## 1. Objectives
- **Local Verification**: Users verify transaction proofs, state roots, and cryptographic signatures locally without trusting a remote server.
- **Environment Parity**: Ship the same logic to all platforms using a single Wasm binary.
- **Performance**: Near-native execution speed for intensive cryptographic operations (Groth16, Musig2, etc.) in the browser.

## 2. Core Targets
- **lib-conxian-core**: Porting core protocol primitives and verification logic to wasm-bindgen.
- **Gateway Engines**: X402 payment validation and OData translation layers.
- **Client-Side Validation (CSV)**: RGB and BitVM2 proof verification.

## 3. Implementation Roadmap
- **Sprint 1**: Audit `lib-conxian-core` for Wasm compatibility (removing non-portable dependencies like `tokio` or filesystem access).
- **Sprint 2**: Implement `wasm-bindgen` wrappers for core verification functions.
- **Sprint 3**: Integrate Wasm logic into the Conxius Wallet (Android) and Conxian UI.

## 4. Security Considerations
- **Memory Safety**: Wasm provides a sandboxed execution environment.
- **Auditability**: Open-source Wasm binaries can be verified against their Rust source.
