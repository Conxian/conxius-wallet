# Native Migration Strategy: The "Clean Break" Roadmap

This document outlines the strategy for fully migrating Conxius Wallet from a hybrid Capacitor/Webview architecture to a pure native Android implementation (Kotlin/Rust/Compose).

## 1. Core Objectives
- **Maximum Sovereignty**: Eliminate reliance on browser environments for cryptographic operations.
- **Hardware-Level Security**: Force all key operations through Android StrongBox/TEE.
- **Offline-First Resilience**: Native database and protocol execution without requiring a JS bridge.
- **Performance**: Reduce memory overhead and improve signing speeds by using native JNI/Rust bindings.

## 2. Migration Phases

### Phase 1: Security & Protocol Foundation (COMPLETED)
- **Status**: ✅ Done (SVN 1.5)
- **Scope**: `:core-crypto` (StrongBox), `:core-bitcoin` (BDK), and `:core-database` (Room).
- **Outcome**: Root of trust established natively.

### Phase 2: Sovereign Interface (COMPLETED)
- **Status**: ✅ Done (SVN 1.5)
- **Scope**: Jetpack Compose UI for Onboarding, Security, and Dashboard.
- **Outcome**: A strictly native app shell that can drive the core wallet functions.

### Phase 3: Protocol Vertical Migration (ACTIVE)
Each Bitcoin ecosystem layer will be moved from TypeScript to native Kotlin/Rust modules.

| Protocol | Migration Path | Target SDK/Library | Priority |
| :--- | :--- | :--- | :--- |
| **Lightning** | Full Native | Breez SDK (Kotlin) | P0 |
| **Liquid** | Full Native | GDK (Green Development Kit) / Rust bindings | P0 |
| **Ark** | Full Native | Ark-Lib (Rust with JNI) | P1 |
| **RGB** | Full Native | RGB-Lib (Rust with JNI) | P1 |
| **State Chains**| Full Native | Kotlin Implementation | P2 |
| **CoinJoin** | Full Native | WabiSabi Kotlin/Rust Client | P1 |
| **Web5** | Hybrid Bridge | Maintain TS bridge until Web5-KT matures | P2 |
| **Wormhole NTT**| Full Native | Kotlin SDK Implementation | P2 |

### Phase 4: Business Logic & Orchestration
- **Status**: PENDING
- **Scope**: Migrating the "Orchestrator" (the logic that decides which layer to use for a transfer) to a native Repository pattern.
- **Components**: `SovereignOrchestrator.kt`, `AssetManager.kt`.

### Phase 5: Institutional (B2B) Alignment
- **Status**: PENDING
- **Scope**: Native implementation of Corporate Profiles and multi-sig policy gating.

## 3. Migration Matrix

| Capability | Migrate to Native? | Reasoning |
| :--- | :---: | :--- |
| **Private Key Operations** | **YES (MANDATORY)** | Security: StrongBox prevents key extraction. |
| **Transaction Parsing** | **YES (MANDATORY)** | WYSIWYS: Native UI prevents web-based spoofing. |
| **Asset Indexing** | **YES** | Performance: SQLite (Room) is faster than LocalStorage. |
| **Network Calls** | **YES** | Security: Native SSL pinning and Tor support. |
| **AI (Gemini)** | **NO** | Keep as API-driven service, but UI must be native. |
| **DeFi UI (DEXs)** | **NO (STAY HYBRID)**| Use a native-hardened Web3 Browser for existing web-based dApps. |

## 4. Verification Standards
- **Protocol Parity**: Native implementation must pass the same test vectors as the TypeScript version.
- **Zero-Leak Memory**: Mandatory use of ephemeral byte arrays and zero-filling.
- **Play Integrity**: Compulsory attestation for all native protocol modules.

---
*Maintained by Conxian Labs Architecture Team*
*Last Updated: 2026-02-28*
