# Technical Specification: BitVM2 Multi-Tap Orchestrator (CON-1217)

**Version:** 1.1
**Status:** RESEARCH / QUARANTINED
**Owner:** Sovereign Engineering

## 1. Scope and current boundary

This document defines the future enablement gate for a BitVM2 wallet
integration. It does **not** claim that a 364-tap verifier, proof segmenter,
challenge source, or dispute transaction builder exists in this repository.

The current TypeScript and Android entrypoints perform only structural checks on
a versioned quarantine/request envelope and return typed non-authoritative
outcomes. No reviewed wallet verifier exists, and no current input may produce
an authoritative `verified` result.

## 2. Versioned quarantine/request envelope

The current quarantine boundary uses the schema ID
`conxian.bitvm2.quarantine-envelope.v1`. This is a versioned transport/request
shape for structural gating, **not** the final canonical BitVM2 protocol
contract. TypeScript and Kotlin intentionally use the same serialized JSON
shape:

- `schemaVersion`
- `proof`
- `verificationKeyId` and `verificationKeyDigest`
- ordered `publicInputs`
- `curve`
- `circuitId`
- `encoding`
- `network` and nested `blockContext: { height, hash }`
- `tapCount` and `tapIndex`
- `domainSeparation`
- `transactionBinding` and `stateBinding`

The shared structural fixture is
`tests/fixtures/bitvm-quarantine-envelope.json`. It is not a positive
cryptographic vector and does not establish a proof, verification key, circuit,
or encoding as valid. The current implementation rejects raw proof strings and
malformed/missing fields. A structurally complete envelope remains `unsupported`
until an independently reviewed backend and protocol artifact registries are
available.

The following enablement details remain unresolved and must not be inferred from
this envelope: canonical proof serialization, verification-key/public-input
serialization, curve and circuit identifiers, encoding rules, verifier-key and
circuit registries, and any cryptographic proof semantics.

## 3. Quarantined components

### 3.1 TypeScript service

`services/bitvm.ts` exposes the versioned quarantine envelope and discriminated
result types (`unsupported`, `simulated`, `malformed`, `invalid`, and a
type-only future `verified` shape). The current verifier always returns
`unsupported` after structural validation. `initiateDispute` and
`signBitVmCommitment` return only non-authoritative outcomes; caller-supplied
`verified` metadata cannot invoke the signer. Challenge discovery is
unavailable; no synthetic challenge or success log is emitted.

### 3.2 Native Android manager

`BitVmManager.kt` exposes sealed outcomes for envelope validation, segment
generation, verification, and dispute signing. It does not return generated
segments or synthetic signatures in debug or release builds. A future native
backend must be reviewed and wired before any authoritative outcome is added.

### 3.3 Signing boundary

If dispute signing is ever enabled, it MUST require verifier-owned authoritative
evidence, a valid tap index, the complete versioned quarantine/request envelope,
and the exact bound dispute transaction. Unsupported, malformed, invalid,
simulated, or caller-fabricated `verified` outcomes MUST never reach a signer.
The current TypeScript and Android implementations therefore have no usable
BitVM2 signing path and no executable `signed` success path.

## 4. Promotion gates

Before enabling an authoritative verifier result or signing path, maintainers
MUST provide:

1. Canonical, versioned serialization specifications for the proof,
   verification key, public inputs, curve, circuit, and encoding, plus immutable
   reviewed verifier and verification-key/circuit registries.
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
