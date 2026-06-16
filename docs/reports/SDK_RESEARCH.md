---
title: SDK Research Report
layout: page
permalink: /docs/sdk-research
---

# SDK Research Report: Full Bitcoin Ecosystem Enhancements

**Date:** 2026-04-18
**Status:** ALIGNED
**Context:** Researching SDKs for BitVM2, Babylon, Ark, and Sovereign Node Enhancements.

## 1. BitVM Bridge (BitVM2)

- **SDK:** `/bitvm/bitvm` (Rust/Script).
- **Status:** **INTEGRATED (ALPHA)**.
- **Verification:** Groth16 SNARK verifier implemented for optimistic proof verification on Bitcoin.
- **Action:** Utilize `Verifier::hinted_verify` for on-chain state root verification in the Gateway.

## 2. Babylon Staking

- **SDK:** `/websites/garden_finance` (JS/API).
- **Status:** **PROTOTYPED**.
- **Issue:** Transitioning from TS payloads to native Taproot staking via `BabylonManager.kt`.
- **Action:** Align with `bitcoinlayers.org` risk metadata for Babylon's staking trust model.

## 3. Ark Protocol (V-UTXO)

- **SDK:** `/cyberark/ark-sdk-golang` (Go/CLI) and `/arkworks-rs/crypto-primitives` (Rust).
- **Status:** **RESEARCH**.
- **Constraint:** Requires native V-UTXO management within the Enclave.
- **Action:** Evaluate Rust-based primitives for high-performance mobile execution.

## 4. Sovereign Node & BOS Enhancements

- **Benchmarking:**
  - **Orchestration:** **Akash Network** (`/websites/akash_network`) for decentralized SDL-based deployment.
  - **Home Servers:** **umbrelOS** (`/getumbrel/umbrel`) for self-hosted service management and Tor hidden services.
  - **Multi-Agent Logic:** **AutoGen** (`/microsoft/autogen`) for autonomous business task orchestration and agent handoffs.
  - **Treasury:** **Safe** (`/websites/safe_global`) for spending limits and multi-sig delegate management.

## 5. Summary Table (v1.9.2 Alignment)

| Technology | Preferred SDK | Target Version | Status |
| :--- | :--- | :--- | :--- |
| **BitVM2** | `bitvm/bitvm` | 1.9 | ✅ |
| **Babylon** | `BabylonManager.kt` | 1.9 | 🚀 |
| **Ark V-UTXO** | `ArkManager.kt` | 1.9 | 🚀 |
| **Autonomous Ops**| `AutoGen` | 2.0 | 🔍 |

---
*Updated: April 18, 2026*

## 6. BitVM2 & Groth16 (CON-1217 Research)
- **Integration Path**: Use `Verifier::hinted_verify` for on-chain state root verification.
- **Chunking Strategy**: The Groth16 verification process is split into 364 independent chunks (taps) for on-chain execution.
  - **VALIDATING_TAPS (1)**: Core arithmetic verification.
  - **HASHING_TAPS (363)**: Hash chain verification for intermediate states.
- **Optimization**: Utilize `/api/generate-groth16-segments` in the Gateway to handle large proofs within Bitcoin script limits.

## 7. FDC3 Interoperability (CON-1181 Research)
- **Standard**: FDC3 v2.x for financial desktop interoperability.
- **Key Method**: `fdc3.raiseIntentForContext(context, [targetApp])` for ergonomic intent resolution.
- **Context Type**: `fdc3.instrument` for mapping Bitcoin layer assets.
