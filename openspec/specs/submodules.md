---
title: Submodules
layout: page
permalink: /./openspec/specs/submodules
---

# Submodule Specification (v1.9.5)

## lib-conxian-core
- **Scope**: Shared protocol alignment logic, API definitions, and research-backed metadata.
- **Role**: Canonical shared layer for the WASM/enclave surfaces (gateway, nexus, UI). It is
  **not** the backing logic for the wallet's Kotlin signers — `conxius-wallet` maintains its own
  self-contained Kotlin implementation (`:core-bitcoin` BouncyCastle/BDK, `:core-crypto` KeyMint/StrongBox).

## conxian-gateway
- **Scope**: B2B entry point for sovereign services and institutional quorums.
- **Components**: API Layer (Actix-web), Engine Layer (Risk/Ecosystem metrics).
- **Services**: Bisq, RGB, BitVM, Changelly proxy.
