---
title: Gap Analysis & Recommendations (Round 2)
layout: page
permalink: /docs/gap-analysis-r2
---

# Gap Analysis & Recommendations (Round 2) - 2026-02-19

## 1. Protocol Implementation Gaps

| Protocol | Status (Registry) | Reality (Code Audit) | Recommendation |
| :--- | :--- | :--- | :--- |
| **Lightning** | PRODUCTION | TS-Only via Breez worker. | Move to Native Breez SDK in :core-bitcoin. |
| **Liquid** | PRODUCTION | TS-Only via liquidjs-lib. | Move to Native Liquid Rust/Kotlin in :core-bitcoin. |
| **EVM (BOB/RSK)** | PRODUCTION | TS-Only via Ethers/Web3. | Move to Native EVM logic in :core-bitcoin. |
| **Ark** | PRODUCTION | TS-Only Simulation. | Implement Native Ark ASP Coordinator Bridge. |
| **StateChain** | PRODUCTION | TS-Only Simulation. | Implement Native StateChain Manager. |
| **Maven** | PRODUCTION | TS-Only Simulation. | Implement Native Maven Bridge. |
| **Musig2** | ✅ PRODUCTION | Rust Core Stub / TS Prototyped. | Fully integrate BIP-327 Rust bindings. |

## 2. Security & Integrity Gaps

- **Play Integrity API:** Current `DeviceIntegrityPlugin.kt` uses legacy/custom checks. Upgrade to official Google Play Integrity SDK as per `SDK_RESEARCH.md`.
- **Stacks Native:** Continued reliance on `stacks.js` in the crypto worker impacts performance. Phase 6 target: `stacks-rust` via JNI.
- **RGB Validation:** Current WASM-based validation in TS is memory-constrained. Migrate to `rgb-lib-kotlin` (JNI).

## 3. Native Bridge Alignment

While `BabylonManager`, `DlcManager`, and `NwcManager` have been bridged in this round, the following still require native managers to move away from purely TS-based construction:
- `ArkManager`
- `StateChainManager`
- `MavenManager`
- `LiquidManager`

## 4. Documentation Drift

- **PRD v1.6.0** claims "PRODUCTION" for almost all protocols, but the implementation is heavily tiered (Native UI -> TS logic -> Native Enclave).
- **Recommendation:** Update PRD to explicitly define the "Bridged Sovereign" architecture where TS handles non-critical logic and Native handles keys and L1/L2 signing.
