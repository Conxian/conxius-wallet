---
title: SDK Research Report
layout: page
permalink: /docs/sdk-research
---

# SDK Research Report: Full Bitcoin Ecosystem Enhancements

**Date:** 2026-06-20
**Status:** EXPANDED — BitVM2 remains research/scaffolding
**Context:** Researching SDKs for BitVM2, Babylon, Ark, and Sovereign Node Enhancements.

## 1. BitVM Bridge (BitVM2)

- **SDK:** `/bitvm/bitvm` (research reference only).
- **Status:** **RESEARCH / QUARANTINED**.
- The wallet currently performs structural validation of a versioned quarantine envelope and returns typed `unsupported` results. It does not integrate a reviewed cryptographic verifier, generate executable segments, discover real challenges, or sign an authoritative dispute.
- The 364-tap count, candidate curve, proof encoding, circuit identifier, verification-key identifier/digest, ordered public inputs, network/block context, domain separation, and transaction/state bindings are enablement-gate metadata—not evidence that verification is implemented.
- No reviewed wallet verifier exists. Upstream research, SDKs, or published mainnet demonstrations must not be treated as a production mobile verifier.

## 2. Babylon Staking

- **SDK:** `/websites/garden_finance` (JS/API) & `BabylonManager.kt`.
- **Status:** **PRODUCTION**.
- **Implementation**: Native Taproot staking via `BabylonManager.kt`.
- **Action**: Align with `bitcoinlayers.org` risk metadata for Babylon's staking trust model.

## 3. Ark Protocol (V-UTXO)

- **SDK:** `/arkworks-rs/crypto-primitives` (Rust).
- **Status:** **RESEARCH**.
- **Implementation Details**: Leveraging Schnorr signatures and Blake2s-based Pseudo-Random Functions (PRF) for deterministic V-UTXO management.
- **Constraint**: Requires native V-UTXO management within the Enclave for high-performance mobile execution via `ArkManager.kt`.

## 4. FDC3 Interoperability (CON-1181)

- **Standard**: FDC3 v2.x for financial desktop interoperability.
- **Native Resolver**: Register `com.conxius.wallet.FDC3_INTENT` in AndroidManifest.
- **Key Method**: `fdc3.raiseIntentForContext(context, [targetApp])` for ergonomic intent resolution.
- **Context Type**: `fdc3.instrument` for mapping Bitcoin layer assets.
- **Bridge**: Implementation requires `Fdc3Plugin.kt` to bridge TypeScript `fdc3.raiseIntent` calls to Android Intent filters.

## 5. Sovereign AI Security (CONX-SEC)

- **Module**: `services/ai-security.ts`.
- **Sanitization**: Outgoing prompts are audited to strip PII and sensitive cryptographic identifiers (addresses, mnemonics, extended keys).
- **Normalization**: ZWC (Zero Width Character) normalization strips obfuscation to prevent bypasses.

## 6. Extended Research Matrix

- See `docs/reports/GAP_MATRIX_2026.md` for detailed gap analysis and candidate scoring.

## 7. Summary Table (v1.9.5 Alignment)

| Technology | Preferred SDK | Target Version | Status |
| :--- | :--- | :--- | :--- |
| **BitVM2** | Research reference only | 1.9 | 🔬 QUARANTINED |
| **Babylon** | `BabylonManager.kt` | 1.9 | ✅ |
| **Ark V-UTXO** | `ArkManager.kt` | 1.9 | 🔬 QUARANTINED |
| **FDC3 Resolver**| `Fdc3Plugin.kt` | 1.9 | 🚀 |
| **AI Security** | `ai-security.ts` | 1.9 | ✅ |

---
*Updated: June 20, 2026*
