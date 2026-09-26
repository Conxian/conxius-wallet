---
title: Comprehensive Strategic Advisory Report
layout: page
permalink: /docs/strategic-advisory-report
---

# Comprehensive Strategic Advisory Report

**Date:** 2026-02-18
**Target:** Conxius Wallet Engineering & Product Team
**Subject:** Strategic Review of Business Logic, Architecture, and Roadmap

---

## 1. Executive Summary

Conxius Wallet has successfully transitioned from a prototype to a **Beta-ready Sovereign Interface**. The codebase adheres strictly to the "No Mock" policy, with clear gates preventing the use of fake data for financial operations.

However, the product is currently in a **"Infrastructure-Blocked"** state. While the Android client code is robust (production-ready signing, storage, and protocol logic), the necessary backend services (Proxies and Smart Contracts) are missing from the live environment.

**Strategic Verdict:** STOP building new client features. START deploying infrastructure.

---

## 2. Business & Design Alignment Review

### ✅ Strong Alignment

- **Sovereignty First:** The `SecureEnclavePlugin` (Java) and `signer.ts` correctly enforce on-device key management. No secrets leave the device.
- **Regulatory Defense:** The architecture successfully avoids "custodial" classification by offloading all regulated flows to partners (Transak, VALR, Changelly) via direct API/SDK integrations.
- **Revenue Model:** The `swap.ts` and `onramp` logic correctly integrates affiliate markers (e.g., THORChain memos), ensuring monetization is baked into the protocol layer.

### ⚠️ Critical Gaps (The "Hollow Shell" Risk)

- **The "Experimental" UX Trap:** Users seeing "Experimental" flags on major features (Bridge, Swap) may perceive the wallet as broken rather than secure.
- **Missing Feedback Loops:** We have no visibility into *failed* infrastructure calls in the wild (e.g., if the Changelly proxy goes down).
- **Test Coverage Mismatch:** We have 100% unit test passing, but **0% E2E coverage** for complex flows like "Bridge -> Swap -> Broadcast".

---

## 3. Infrastructure-First Roadmap (Immediate Actions)

We must pivot from "App Development" to "Platform Operations".

### Phase 1: The "Real Rails" Sprint (Weeks 1-2)

**Goal:** Unblock Swaps and Bridging on Mainnet.

1. **Deploy Changelly Proxy:**
    - Use the scaffolded `infrastructure/gcp/changelly-proxy`.
    - **Action:** `gcloud run deploy` (as documented in `docs/GCP_INFRASTRUCTURE.md`).
    - **Result:** Unblocks `swap.ts` / `createChangellyTransaction`.

2. **Deploy Bisq Node:**
    - Provision the GCE instance.
    - **Action:** Secure the gRPC tunnel.
    - **Result:** Unblocks Decentralized Exchange features.

3. **Wormhole Contract Deployment:**
    - We cannot use the public Wormhole generic relayers for custom NTT logic if we want "Sovereign Proofs".
    - **Action:** Deploy `TokenManager` and `Transceiver` contracts to Ethereum, Arbitrum, and Base.
    - **Result:** Unblocks `ntt.ts` / `executeBridge`.

### Phase 2: User Safety & Trust (Weeks 3-4)

**Goal:** Make the app safe for grandmother-level users.

1. **Implement Play Integrity (Attestation):**
    - The client-side `PlayIntegrityPlugin.kt` now acquires opaque Standard API tokens, but the GCP backend hook, request-hash comparison, and production enforcement remain pending.
    - **Why:** A verified backend policy can help prevent sensitive operations from proceeding on environments that fail the reviewed integrity requirements.

2. **E2E Testing Suite:**
    - Write Playwright tests that run against *Testnet* infrastructure.
    - **Why:** Unit tests don't catch API schema changes or network timeouts.

---

## 4. Codebase Recommendations

### Refactor `NTTBridge.tsx` UX

Current state shows a "technical" view of the bridge.

- **Recommendation:** Move to a "Outcome-Based" UI. Instead of "Source -> Target", ask "What do you want to achieve?" (e.g., "Move BTC to Defi").
- **Fix:** The progress poller in `NTTBridge.tsx` is good, but should persist state across app restarts (store pending tx hashes in `localStorage`).

### Hardening `signer.ts`

- **Observation:** The signer is solid, but `signBip322Message` is complex.
- **Recommendation:** Add a specific "Sign Login Message" UI component that parses the message clearly for the user, rather than just showing a raw string.

### Feature Flag Cleanup

- Once infrastructure is live, we must systematically remove `_EXPERIMENTAL` flags.
- **Risk:** Leaving flags in `production` builds can lead to accidental enabling of mock paths if logic is inverted.
- **Fix:** Remove the mock code paths entirely in the next major refactor, rather than just gating them.

---

## 5. Final Word

You have built a Ferrari engine (The Conclave) and put it in a beautiful chassis (The UI). But you haven't put gas in the tank (Infrastructure).

**Do not write more React components.** Go to Google Cloud Console and deploy the backend rails. The code is ready; the network is waiting.

---

## 6. Org-Wide SLA Strategy & Strategic Advisory Realignment

### 6.1 The Core Reality: Open-Source Funding vs. Enterprise SLAs
Commercial SLAs (99.9% uptime, 1-hour incident response, guaranteed patch delivery) are legally and financially binding guarantees backed by financial penalty clauses. In early-stage sovereign infrastructure:
- **Lumpy Funding**: Pre-seed budgets, grants, or early trial revenues cannot sustain a 24/7/365 follow-the-sun incident response engineering team.
- **Maintainer Bottleneck**: Core architecture relies on lean, specialized teams. PagerDuty alarms for non-critical bugs paralyze protocol engineering.
- **Asymmetric Sovereign Security Risk**: Hardware security modules (HSMs), TEEs, and Bitcoin L1 layers carry irreversible security risks. Rushed patches under tight SLA windows invite key exposure or state corruption.

### 6.2 Peer Open-Source Ecosystem Comparison

| Dimension | Typical Open-Source Infra Player | Conxian Ecosystem Profile |
| :--- | :--- | :--- |
| **Surface Area** | Focused (1–3 libraries / single SDK) | Expansive: L1 primitives (`lib-conxian-core`), enclaves (`conxius-enclave-sdk`), mobile wallet (`conxius-wallet`), sovereign state layer (`conxian-nexus`), and enterprise gateway (`conxian-gateway` / ISO 20022). |
| **Support Model** | Community best-effort; bounded enterprise tiers. | Bridges sovereign Bitcoin tech with enterprise finance (ISO 20022), inviting corporate expectations. |
| **SLA Strategy** | No SLA for public repos; SLAs restricted to paid enterprise wrappers. | Must avoid over-committing uptime metrics on decentralized consensus layers. |

### 6.3 Tiered SLA Framework & Strategic Guidance
1. **Decouple Protocol from Enterprise Wrapper**:
   - Public repositories (`conxius-wallet`, `lib-conxian-core`, `conxius-enclave-sdk`, `conxian-nexus`) carry **NO commercial SLA**. Support is best-effort.
   - B2B Gateway (`conxian-gateway` / ISO 20022) offers SLAs **exclusively** under signed commercial contracts, strictly bounded to integration support and business-hours response windows.
2. **Exclude External Dependencies from Liability**:
   - SLAs must explicitly exclude Bitcoin/Stacks/Liquid network halts, network congestion, and vendor hardware enclave firmware deprecations.
3. **Automate Guardrails**:
   - Rely on automated CI/CD pipelines, fail-closed runtime guards (`ProductionRuntimeGuard`), and staging verification to maintain code quality without burning engineering bandwidth.
