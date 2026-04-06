---
title: Sovereign State
layout: page
permalink: /./Sovereign_State
---

# Sovereign State - Conxius Wallet (v1.6.0)

## Core Modules Status

| Module | Status | Description |
| :--- | :--- | :--- |
| **:app** | ✅ PRODUCTION | Main Android application (Kotlin/Compose). |
| **:core-crypto** | ✅ PRODUCTION | Native StrongBox/TEE Keystore (Kotlin). |
| **:core-bitcoin** | ✅ PRODUCTION | Native BDK and Protocol Managers (Kotlin). |
| **:core-database** | ✅ PRODUCTION | Encrypted SQLCipher/Room Storage (Kotlin). |
| **lib-conxian-core** | ✅ PRODUCTION | Rust Core (Musig2, AluVM, Gateway). |
| **services/** | ✅ BRIDGED | TS Protocol logic & Native Bridge interfaces. |
| **components/** | ✅ BRIDGED | React/Capacitor UI & Bridge hooks. |

## Feature Implementation Registry

| Feature | Status | Description |
| :--- | :--- | :--- |
| [NTT_TRANSCEIVER] | [COMPLETED] | Wormhole NTT Transceiver for Conclave signatures. |
| [NTT_MANAGER] | [COMPLETED] | Native Kotlin manager for NTT payload construction. |
| [BABYLON_STAKING] | [BRIDGED] | Native Taproot staking for Babylon protocol. |
| [DLC_CONTRACTS] | [BRIDGED] | Native DlcManager for Discreet Log Contracts. |
| [TAPROOT_ASSETS] | [BRIDGED] | Discovery and transfer logic for Taproot Assets. |
| [B2B_GATEWAY] | [BRIDGED] | Institutional signing and treasury authorization. |
| [ARK_VUTXO] | [COMPLETED] | Native Ark V-UTXO lifecycle and Stacks anchoring. |
| [TEE_SETTLEMENT] | [COMPLETED] | Verified TEE-verified proposal-only triggers (CON-162). |
| [REVENUE_ENGINE] | [COMPLETED] | Clarity 4.0 protocol fee automation (1% Extraction). |
| [DOCS_ALIGNMENT] | [COMPLETED] | Jekyll frontmatter and LaTeX formula optimization. |

---
*Last Updated: April 2026*
