---
title: "Wasm-First Gateway Strategy"
status: PROPOSAL
date: 2026-06-15
issue: CON-1217
---

# [Phase 7] Wasm-First Gateway Strategy

## Executive Summary
To achieve true "Local-First" sovereign verification for reviewed protocol
implementations, Conxian is evaluating a transition of performance-critical and
verification-heavy logic from native Rust environments to WebAssembly (Wasm).
This proposal does not indicate that a BitVM2 verifier is currently shipped or
enabled.

## 1. Objectives
- **Local Verification**: For reviewed implementations, users verify transaction proofs, state roots, and cryptographic signatures locally without trusting a remote server.
- **Environment Parity**: Ship the same logic to all platforms using a single Wasm binary.
- **Performance**: Near-native execution speed for intensive cryptographic operations (Groth16, Musig2, etc.) in the browser.

## 2. Core Targets
- **lib-conxian-core**: Porting core protocol primitives and verification logic to wasm-bindgen.
- **Gateway Engines**: X402 payment validation and OData translation layers.
- **Client-Side Validation (CSV)**: Future RGB and BitVM2 research boundaries; no reviewed BitVM2 Wasm verifier is integrated today.

## 3. Implementation Roadmap
- **Sprint 1**: Audit `lib-conxian-core` for Wasm compatibility (removing non-portable dependencies like `tokio` or filesystem access).
- **Sprint 2**: Implement `wasm-bindgen` wrappers for core verification functions.
- **Sprint 3**: Integrate Wasm logic into the Conxius Wallet (Android) and Conxian UI.

## 4. BitVM2 Enablement Gate

BitVM2 remains **RESEARCH / QUARANTINED**. The current TypeScript and Android
paths validate only a versioned quarantine/request envelope and return typed
non-authoritative outcomes. Wasm integration cannot promote those outcomes to
verification or signing.

Canonical proof, verification-key, public-input, curve, circuit, and encoding
serialization and registries remain unresolved. A reviewed verifier, reproducible
positive and negative vectors, independent cryptographic review, and an exact
transaction-signing policy are required before any BitVM2 Wasm path can be
enabled.

## 5. Security Considerations
- **Memory Safety**: Wasm provides a sandboxed execution environment.
- **Auditability**: Open-source Wasm binaries can be verified against their Rust source.
