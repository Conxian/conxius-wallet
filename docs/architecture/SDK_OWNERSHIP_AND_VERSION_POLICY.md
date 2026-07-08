---
title: SDK Ownership and Version Policy
layout: page
permalink: /docs/sdk-policy
---

# SDK Ownership and Version Policy (v1.9.5)

**Date:** 2026-06-17
**Status:** VERIFIED
**Issue:** CON-1178

## 1. Canonical Ownership

To maintain boundary clarity and prevent dependency sprawl, ownership of core SDK families is defined as follows:

| SDK Family | Canonical Owner | Primary Consumer(s) | Maturity |
| :--- | :--- | :--- | :--- |
| **Stacks.js** | `lib-conxian-core` | Wallet, UI, Gateway | PRODUCTION (v7.4.x) |
| **BDK Kotlin** | `conxius-wallet` (:core-bitcoin) | Wallet (Native) | PRODUCTION (v0.30.0) |
| **Wormhole SDK** | `conxian-gateway` | Wallet (BFF), UI | BRIDGED |
| **Clarity SDK** | `conxian-nexus` | Protocol, Orbit | DEVELOPMENT |
| **BitVM2 (Rust)** | `lib-conxian-core` | Gateway, Nexus | ALPHA |
| **FDC3 (Native)** | `conxius-wallet` | Enterprise Plugins | RESEARCH |
| **Enclave Primitives**| `conxius-enclave-sdk` | Wallet (:core-crypto) | SECURITY-CRITICAL |

## 2. Version Policy

### 2.1. Shared Core (lib-conxian-core)
- App-layer repositories MUST consume `lib-conxian-core` via pinned Git revisions or tagged releases.
- Breaking changes in the core MUST be accompanied by a version bump and migration guide.

### 2.2. Native Android Managers
- All native managers in `conxius-wallet` (:core-bitcoin) MUST follow semantic versioning.
- Third-party SDKs (e.g., Breez, BDK) MUST be managed via `libs.versions.toml`.

### 2.3. Beta/RC Dependencies
- Security-sensitive layers (e.g., `conxius-enclave-sdk`) MUST explicitly document the use of any beta or RC dependencies.
- Use of unstable dependencies in PRODUCTION paths is discouraged unless no viable alternative exists.

## 3. Consumption Guidance

### 3.1. Shared-Core vs. Repo-Local
- **Shared-Core**: Use for cross-repo protocol primitives, data models, and cryptographic logic.
- **Repo-Local**: Use for repository-specific integration code, UI logic, and transient adapters.

### 3.2. SDK Provider vs. Consumer
- Repositories designated as **SDK Providers** (e.g., `lib-conxian-core`) MUST maintain high release-discipline maturity, including comprehensive tests and changelogs.
- **Consumers** MUST NOT bypass official SDK interfaces to access internal primitives.

---
*Verified by Jules (v1.9.5 Alignment).*
