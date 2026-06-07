---
title: Sovereign State
layout: page
permalink: /./Sovereign_State
---

# Sovereign State - Conxius Wallet (v1.9.2)

## Core Modules Status

| Module | Status | Description |
| :--- | :--- | :--- |
| **:app** | ✅ PRODUCTION | Main Android application (Kotlin/Compose). |
| **:core-crypto** | ✅ PRODUCTION | Native StrongBox/TEE Keystore (Kotlin). |
| **:core-bitcoin** | ⚠️ PARTIAL | Native BDK and protocol managers exist, but some advanced flows remain bridged or debug-simulated until production-backed execution is complete. |
| **:core-database** | ✅ PRODUCTION | Encrypted SQLCipher/Room Storage (Kotlin). |
| **lib-conxian-core** | ⚠️ PARTIAL | Rust core exists, but production enforcement depends on the specific feature path and backing implementation. |
| **services/** | ✅ BRIDGED | TS protocol logic and native bridge interfaces. |
| **components/** | ✅ BRIDGED | React/Capacitor UI and bridge hooks. |

## Feature Implementation Registry

| Feature | Status | Description |
| :--- | :--- | :--- |
| [NTT_TRANSCEIVER] | [COMPLETED] | Wormhole NTT transceiver for Conclave signatures. |
| [NTT_MANAGER] | [COMPLETED] | Native Kotlin manager for NTT payload construction. |
| [BABYLON_STAKING] | [BRIDGED] | Native Taproot staking for Babylon protocol. |
| [DLC_CONTRACTS] | [DEBUG_SIMULATED] | Native `DlcManager` exists, but current execution path is debug-only simulated and fails closed in release builds. |
| [TAPROOT_ASSETS] | [BRIDGED] | Discovery and transfer logic for Taproot Assets. |
| [B2B_GATEWAY] | [BRIDGED] | Institutional signing and treasury authorization. |
| [ARK_VUTXO] | [COMPLETED] | Native Ark V-UTXO lifecycle and Stacks anchoring. |
| [TEE_SETTLEMENT] | [PARTIAL] | Native security controls exist, but production enforcement depends on the exact attestation and backend verification path. |
| [REVENUE_ENGINE] | [COMPLETED] | Clarity 4.0 protocol fee automation (1% Extraction). |
| [ODATA_TRANSLATION] | [COMPLETED] | OData v4 translation layer for ERP integration (CON-63). |
| [SAB_TREASURY_MAP] | [COMPLETED] | Canonical wallet destinations and handoff sequence (CON-482). |
| [DOCS_ALIGNMENT] | [COMPLETED] | Jekyll frontmatter and LaTeX formula optimization. |

---
*Last Updated: June 2026*
