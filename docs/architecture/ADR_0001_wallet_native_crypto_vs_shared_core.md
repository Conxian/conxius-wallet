# ADR-0001: Wallet-native crypto vs. shared Rust core

**Status:** Accepted
**Date:** 2026-10-04
**Deciders:** Conxian wallet/broad-enablement track

## Context

`conxius-wallet` and the Rust SDKs (`lib-conxian-core`, `conxius-enclave-sdk`)
implement overlapping cryptographic and protocol primitives: secp256k1/Schnorr
(BIP-340), Taproot (BIP-341/86/350), MuSig2 (BIP-327) / FROST, BOLT-11 invoice
signing, DLC adaptor signatures, BIP-322 message signing, and the Stacks/Liquid/
Babylon adapters.

The wallet does **not** consume the Rust SDKs at build time. Its primitives live
in self-contained Kotlin modules: `:core-bitcoin` (BouncyCastle/BDK) and
`:core-crypto` (AndroidX KeyMint/StrongBox). This duplication is the direct
consequence of the "broad enablement" pivot (Phases 1–5), which rebuilt native
Kotlin signing paths rather than bridging to the Rust/WASM core.

## Decision

Keep the split. The wallet maintains its own self-contained Kotlin
implementation of these primitives. It does not adopt `lib-conxian-core` or
`conxius-enclave-sdk` via JNI/UniFFI or WASM.

### Rationale

- **Non-custodial trust boundary.** Wallet signing must happen inside Android
  secure hardware (StrongBox/KeyMint) with the secret never crossing to JS. A
  Rust→JNI bridge would run in-process (outside secure hardware), and a
  Rust→WASM bridge would reintroduce the "secret in JS" anti-pattern the wallet
  was built to avoid.
- **Surface mismatch.** The Rust SDKs target WASM (gateway/nexus/UI) and
  server-side Nitro enclaves, not the Android JVM. The two are not trivially
  interchangeable.

## Consequences

### Accepted risk

- Two implementations of the same primitives can silently diverge (nonce
  handling, low-S, address encoding, tweaks).

### Obligations (mandatory)

1. **Shared test vectors.** Both the Rust SDKs and the wallet MUST validate the
   overlapping primitives against the same canonical vectors — BIP-340, BIP-327,
   BIP-322, dlcspecs adaptor, BOLT-11 — sourced from a single canonical fixtures
   location (`lib-conxian-core/fixtures/`, see the follow-up work item).
2. **Honest documentation.** No doc may claim the wallet "consumes" the Rust core
   or that the core "provides the backing logic for Kotlin signers". Corrected in
   `SDK_OWNERSHIP_AND_VERSION_POLICY.md`, `openspec/specs/submodules.md`, and
   `v1.9.5_RESEARCH_EXPANSION_REPORT.md`.
3. **BIP status accuracy.** BIP references must carry their real status. See the
   BIP-110 correction (Closed, not Complete) in
   `docs/operations/CLEAN_BLOCK_FEE_MODEL.md`.
