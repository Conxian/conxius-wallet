# Approved Bridge & Messaging Systems by Trust Tier

**Date:** 2026-06-08
**Status:** APPROVED
**Context:** CON-791 Research Outcome

---

## 1. Trust-Tier Taxonomy

| Tier | Policy Name | Required Trust Class | Production Allowance |
| :--- | :--- | :--- | :--- |
| **T1** | Sovereign Verified | `proof_verified` | Allowed for treasury-critical, governance/control-plane, and canonical asset routes |
| **T2** | Hybrid Verified | `proof_verified` **plus** independent secondary verifier(s) | Allowed for production value + control-plane when T1 is unavailable |
| **T3** | Attester Network | `attester_verified` | Allowed for capped/non-canonical value routes with strict limits and kill-switches |
| **T4** | Observer/Weak | `observer_only` | **Not allowed** in production (test/sandbox only) |

---

## 2. Approved Systems by Tier

| System | Default Trust Class | Approved Tiers | Approval Status | Required Conditions |
| :--- | :--- | :--- | :--- | :--- |
| **IBC (light-client)** | `proof_verified` | **T1**, T2 | **Approved** | Must use light-client/consensus verification path; no downgrade to committee/observer modes for T1 routes |
| **Hyperlane** | `attester_verified` | **T2**, T3 | **Conditionally Approved** | T2 requires Aggregation/custom ISM with independent verifier domains + strict threshold policy |
| **LayerZero v2** | Config-dependent | **T2**, T3 | **Conditionally Approved** | T2 requires hardened multi-DVN config, operator diversity, pinned config, and drift checks |
| **Wormhole NTT** | `attester_verified` | **T3** (T2 conditional) | **Conditionally Approved** | Mandatory per-route caps, replay protection, emergency pause, and explicit route allowlists |
| **Axelar GMP** | `attester_verified` | **T3** | **Conditionally Approved** | Use for capped corridors; not for sovereign-root treasury/governance pathways |

---

## 3. Forbidden Usage Patterns

1. **Single-Source production**: Any single-attestor / single-verifier production route for value-bearing traffic.
2. **Mutable Defaults**: Mutable or default verifier configs treated as production-safe without explicit hardening.
3. **Unlimited Authority**: Unlimited mint/unlock authority without caps, rate limits, and emergency halt controls.
4. **Governance on T3/T4**: T3/T4 routes used for treasury rebalancing, governance execution, or canonical issuance.
5. **Correlated Verifiers**: Correlated “independent” verifiers (same trust/operator domain) counted as separate guarantees.
6. **Silent Downgrade**: Silent trust downgrade at runtime (e.g., `proof_verified` route falling to `observer_only`).

---

## 4. Metadata Requirements

Every operation must include a canonical proof envelope:

- `system`: ibc | wormhole_ntt | hyperlane | layerzero_v2 | axelar
- `trustTier`: T1 | T2 | T3 | T4
- `verificationClass`: light_client | external_quorum | app_defined_multiverifier | shared_pos
- `finalityClass`: economic | probabilistic | deterministic
- `observedAt`: RFC3339 timestamp
- `evidenceHash`: sha256 digest of the proof/VAA

---

*Verified by Conxius Sovereign Architecture v1.9.5.*
