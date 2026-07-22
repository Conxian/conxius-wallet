# Technical Specification: BitVM2 Multi-Tap Orchestrator (CON-1217)

**Version:** 1.1
**Status:** RESEARCH / QUARANTINED
**Owner:** Sovereign Engineering

## 1. Scope and current boundary

This document defines the future enablement gate for a BitVM2 wallet
integration. It does **not** claim that a 364-tap verifier, proof segmenter,
challenge source, or dispute transaction builder exists in this repository.

The current TypeScript and Android entrypoints perform only structural contract
validation and return typed non-authoritative outcomes. No reviewed wallet
verifier exists, and no current input may produce an authoritative `verified`
result.

## 2. Canonical proof envelope

Every future verifier request MUST use one canonical envelope containing:

- `schemaVersion`
- `proof`
- `verificationKeyId` and `verificationKeyDigest`
- ordered `publicInputs`
- `curve`
- `circuitId`
- `encoding`
- `network` and `blockContext`
- `tapCount` and `tapIndex`
- `domainSeparation`
- `transactionBinding` and `stateBinding`

The current implementation rejects raw proof strings and malformed/missing
fields. A structurally complete envelope remains `unsupported` until the
reviewed backend and its immutable artifact registry are available.

## 3. Quarantined components

### 3.1 TypeScript service

`services/bitvm.ts` exposes the canonical envelope and discriminated result
types (`unsupported`, `simulated`, `malformed`, `invalid`, and future
`verified`). The production verifier always returns `unsupported` after
structural validation. Challenge discovery is unavailable; no synthetic
challenge or success log is emitted.

### 3.2 Native Android manager

`BitVmManager.kt` exposes sealed outcomes for envelope validation, segment
generation, verification, and dispute signing. It does not return generated
segments or synthetic signatures in debug or release builds. A future native
backend must be reviewed and wired before any authoritative outcome is added.

### 3.3 Signing boundary

Dispute signing MUST require authoritative verification evidence, a valid tap
index, the complete canonical envelope, and the exact bound dispute transaction.
Unsupported, malformed, invalid, or simulated outcomes MUST never reach a
signer. The current implementation therefore has no usable BitVM2 signing
path.

## 4. Promotion gates

Before enabling `verified`, maintainers MUST provide:

1. An immutable reviewed verifier revision and verification-key/circuit registry.
2. Reproducible positive and negative vectors, including wrong-key, mutated,
   malformed, encoding, network, binding, and tap-index cases.
3. Independent cryptographic review and reproducible Android/native builds.
4. A native policy boundary that signs only the exact validated dispute
   transaction and preserves local-first privacy.
5. Evidence tying the implementation to the pinned protocol artifacts; a
   research demo or unrelated mainnet transaction is insufficient.

Until those gates pass, the status remains **RESEARCH / QUARANTINED**. Any
evaluation-only simulation must be explicitly labeled `simulated` and can never
be used as authoritative signing evidence.
