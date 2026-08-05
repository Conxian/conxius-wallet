---
title: Product Requirements Document
layout: page
permalink: /prd
---

# Conxius Wallet PRD (Full Bitcoin Ecosystem) - v1.9.5

## 1. Executive Summary

**Product:** Conxius Wallet, the **Ultimate Multi-Chain Sovereign Interface for the Full Bitcoin Ecosystem**. It is an offline-first Android wallet that uses Android Keystore-backed security boundaries across the Bitcoin stack: L1 (BTC), Lightning, Liquid, Stacks, Rootstock (RSK), BOB (Build On Bitcoin), RGB, Ordinals, Runes, Ark, BitVM, State Chains, and Maven. The hardware security tier is device- and policy-specific and remains subject to release qualification.

**Mission:** Empower users with sovereign control over the entire Bitcoin landscape through a unified, secure, and intuitive mobile interface.

**Value Proposition:** *The Citadel in your pocket.* Android Keystore-backed security for the Bitcoin ecosystem without external hardware; StrongBox is requested or required only where explicit evidence and release policy support that claim.

**Institutional Expansion:** The ecosystem is enhanced by the **Conxian Gateway** (hosted at `conxianlabs.com`), a B2B-focused web portal for corporate treasury, institutional token launches, and shielded enterprise payments, fully integrated with the mobile enclave.

**Monetization:** Network utility fees (routing, swaps, bridge execution), gas abstraction services, and B2B SaaS subscriptions.

---

## 2. Business & Competitive Landscape

### 2.1. Business State: [RELEASE-BASELINE HARDENING IN PROGRESS] (Complexity: $O(1)$)

- **[MARKET_FIT]:** [ORCHESTRATING]
- **[RISK_COMPLIANCE]:** [ORCHESTRATING]
- **[TOKENOMICS]:** [ORCHESTRATING]
- **[ROADMAP]:** [ALIGNED - PHASE 5]

---

## 3. Core Technical Specifications

### 3.1. Bridged Sovereign Architecture (Complexity: $O(1)$)

Conxius utilizes a **Bridged Sovereign Architecture** to balance rapid protocol support with Android Keystore-backed security:
- **Native Enclave Core**: Private keys and seeds are managed by Android Keystore-backed boundaries. Existing AES seed/database storage requests StrongBox where supported but can explicitly fall back to TEE. Native signing is a custody boundary, not proof that every protocol key is StrongBox-backed or hardware-qualified.
- **TypeScript Protocol Layer**: High-level protocol logic (payload construction, API interaction) is handled in a secure TS environment.
- **Native Bridge Managers**: A full suite of 20+ Kotlin managers (e.g., `BdkManager`, `YieldManager`) bridge the TS layer to native Rust/Kotlin libraries for critical operations.

### 3.2. Native Migration (Phase 5: "Clean Break") (Complexity: $O(1)$)

The project is transitioning to a **pure native Android architecture** (Kotlin/Rust):
- **Core Security**: Android Keystore AES-GCM encryption for BIP-39 seeds, requesting StrongBox where supported with an explicit TEE fallback. Device-specific StrongBox qualification remains pending. [IMPLEMENTED / RELEASE VALIDATION PENDING]
- **Protocol Core**: BDK (Bitcoin Dev Kit) for on-chain management. [PRODUCTION]
- **Persistence**: Room DB with KSP for reactive, encrypted data storage. [PRODUCTION]
- **UI/UX**: Jetpack Compose for a high-performance interface. [PRODUCTION]

The dedicated P-256 KeyMint authorization boundary and Play Integrity client
boundary are documented in the [CON-1544 qualification report](../reports/CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md).
They do not by themselves authorize value operations or qualify protocol
signing keys for StrongBox-backed production use.

The wallet-local issue #444 boundary is **Implemented — fail-closed
containment; production execution unsupported**. A versioned canonical envelope,
typed authorization queue, exact artifact binding, native-only gate-bound PSBT
signer, and typed adapter outcomes now prevent reviewed legacy paths from
reporting synthetic success. The production verifier still always returns
`unsupported_provider`; this boundary is not provider, hardware, backend,
receipt/finality, or release qualification. See the
[issue #444 evidence record](../reports/ISSUE_444_VALUE_OPERATION_GATE_CONTAINMENT.md).

### 3.3. Security & CI/CD Hygiene (Complexity: $O(1)$)

To enforce Zero-Secret Egress and deterministic trust/safety across the development lifecycle, the following controls are strictly maintained:
- **Gitleaks (Primary)**: A pinned, checksum-verified tokenless Gitleaks CLI scanner enforces hard-gate scanning of full repository history.
- **GitGuardian (Secondary)**: An optional secondary scanner is configured with `continue-on-error: true` to prevent third-party credential drift or expired/missing API keys from causing false-positive blocking of the primary development CI pipeline.

---

## 4. Functional Requirements (v1.9.5 Alignment)

| Protocol | Status | Implementation Details |
| :--- | :--- | :--- |
| **Bitcoin L1** | CONTAINED / EXECUTION UNSUPPORTED | Native BDK construction/custody surfaces remain, but reviewed wallet value signing and broadcast require the issue #444 gate; no qualified production evidence verifier or broadcast receipt exists. |
| **Lightning** | CONTAINED / EXECUTION UNSUPPORTED | Breez/native integration exists, but reviewed payment paths return typed unsupported outcomes before payment side effects. |
| **Stacks** | BRIDGED | Stacks.js (TS) + Native Stacks Manager |
| **Liquid** | BRIDGED | Liquidjs (TS) + Native Liquid Manager |
| **Babylon** | BRIDGED | TS Payload + Native Babylon Manager |
| **DLCs** | CONTAINED / EXECUTION UNSUPPORTED | Acceptance/settlement artifacts require exact authorization binding; no qualified production adapter or provider receipt exists. |
| **BOB / RSK** | BRIDGED | TS Ethers + Native EVM Manager |
| **RGB / BitVM** | RESEARCH / QUARANTINED | RGB value operations are contained and unavailable; BitVM2 has structural envelope validation only. No reviewed authoritative verifier/signing path exists. |
| **Ark / StateChain** | CONTAINED / EXECUTION UNSUPPORTED | Exact artifacts and typed outcomes replace synthetic txids/completions; no qualified production adapter exists. |
| **Web5** | BRIDGED | Web5 API (TS) + Native Web5 Manager |
| **Yield / Insurance** | CONTAINED / EXECUTION UNSUPPORTED | Reviewed value-bearing actions fail closed; discovery/non-value presentation is separate. |
| **Swap / B2B** | CONTAINED / EXECUTION UNSUPPORTED | Reviewed swap, bridge, merchant, and settlement execution paths do not submit or claim completion without qualified evidence and receipts. |

---

*Verified by OpenSpec Alignment Design.*

---

## 5. UI/UX STANDARDIZATION (Sovereign Earthy)

As of v1.9.5, all Conxian Protocol interfaces (Conxius Wallet, Gateway, Explorer) MUST adhere to the **Sovereign Earthy** visual identity.

### 5.1. Design Ethos
- **Foundational Palette**: 60% Ivory (#FDFBF7), 30% Pure White (#FFFFFF), 10% Earth/Brand Tones.
- **Institutional Clarity**: High-contrast dark typography against bright surfaces to ensure financial data legibility and reduce cognitive fatigue.
- **Atmospheric Cues**: Hero sections and primary brand headers may utilize full-bleed deep brand colors to establish presence.
- **Interaction Model**: Use structural spacing and micro-borders (1px) for depth, minimizing heavy drop shadows to maintain a crisp, professional aesthetic.

## Operating Model & Documentation Architecture (v1.9.5)

### 1. Decoupled Documentation Model (CON-1208)
- **Brand & Product Site (conxian.org)**: Primary consumer-facing surface for vision, product features, and community.
- **Labs & Ecosystem (conxian-labs.com)**: Directory for portfolio projects, lab initiatives, and ecosystem partners.
- **Technical Repository Docs**: Every repository owns its technical documentation (README, CHANGELOG, ARCHITECTURE, etc.), published via GitHub Pages where applicable.
- **Internal Control Plane**: Internal governance and operating models are housed in the `docs/` directory of the core business orchestration repositories.

### 2. Artifact Promotion Governance
Promotion from `staged` to `main` for any production artifact requires explicit sign-off from the COO as defined in the [Operating Model](../operations/OPERATING_MODEL.md).
Issue #444 is P0 containment work and requires the same COO review before
promotion; its presence must not be marketed as production support.
