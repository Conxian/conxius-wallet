# Conxian-Labs: Systemic Alignment & Enhancement Plan (ATS v12.0)

This document outlines the sequential steps required to align the Conxian-Labs codebase with production-grade standards and reconcile Linear "Done" status with technical reality.

## 1. Logic Recovery & Bridging (Phase 1)
**Goal:** Implement missing components marked as "Done" in Linear but missing from the repo.

- **[CORE]** Implement `core/revenue-automation.clar` (1% protocol fee extraction).
- **[FINANCE]** Implement `core/dlc-orchestrator.clar` (Bitcoin DLC bond lifecycle).
- **[YIELD]** Implement `core/referral-aggregator.clar` (5-5-5 referral logic).
- **[GATEWAY]** Implement OData v4 translation layer in `lib-conxian-core/gateway/src/engine/mod.rs`.
- **[COMPLIANCE]** Integrate ZKML verification logic in Gateway.

## 2. Tool-to-Code Integration (Phase 2)
**Goal:** Replace mocks with real-world tool data flows.

- **[SUPABASE]** Wire `services/protocol.ts` to the `Conxian-platform` project for real TVL and metric tracking.
- **[NEON]** Integrate `mmr_nodes` table in `Conxian-backend` with the Gateway proof generation API.
- **[RENDER]** Verify CI/CD pipeline in Render includes the mandatory linting/type-check steps (CON-30).

## 3. Brand & Identity Purge (Phase 3)
**Goal:** Complete the transition to cxn-arch-guardian identity.

- **[IDENTITY]** [COMPLETED] Rename remaining "Sentinel" and "cnx" identifiers in tests and auxiliary scripts.
- **[DOCS]** Synchronize `Business_State.md` and `Sovereign_State.md` with the actual recovered code state.

## 4. Technical Verification
**Goal:** Ensure production readiness.

- **[TESTING]** Add Vitest and Clarinet tests for all recovered logic.
- **[SECURITY]** Run a final audit on the "Zero Secret Egress" (ZSE) compliance for recovered modules.

---
*Created: March 2026*
