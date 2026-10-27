# Operations Guide: GitHub Projects, Issues, and Knowledge Base Management

**Version:** 1.9.5
**Date:** October 2026
**Status:** APPROVED & OPERATIONAL
**Scope:** Conxian Ecosystem GitHub Organization (`conxius-wallet`, `conxian-nexus`, `conxian-gateway`, `lib-conxian-core`)

---

## 1. Executive Summary & Management Architecture

To maintain sovereign production readiness and drive Nexus business opportunities across decentralized protocols, Conxian Labs enforces a unified, structured **GitHub Management Framework**.

This framework integrates:
1. **GitHub Issue Forms (YAML)**: Standardized entry points for bugs, baseline reviews, governance, and Nexus/Decentralized System initiatives.
2. **GitHub Projects (v2)**: Organization-level project boards managing roadmaps, production gates, and decentralized candidate scoring.
3. **Knowledge Base (KB) Integration**: Cross-linking GitHub Issues directly to canonical Knowledge Base articles in `docs/kb/` for developer playbooks and troubleshooting.

---

## 2. GitHub Project Boards Architecture

All repository initiatives are synchronized across three canonical GitHub Projects (v2):

```
+-----------------------------------------------------------------------------------+
|                        CONXIAN GITHUB PROJECTS (V2) MATRIX                         |
+-----------------------------------------------------------------------------------+
| 1. STRATEGY & ROADMAP BOARD                                                        |
|    - Focus: High-level milestones, epic features, and ecosystem releases (v1.9.5+). |
|    - Views: Table (by Milestone), Board (by Status), Roadmap (Timeline).           |
+-----------------------------------------------------------------------------------+
| 2. PRODUCTION READINESS & GATEKEEPING BOARD                                       |
|    - Focus: P0/P1 value containment gates (#444), KeyMint, zero-secret egress, CI. |
|    - Views: Fail-Closed Audit, Toolchain Compliance, Release Gate Checklist.       |
+-----------------------------------------------------------------------------------+
| 3. NEXUS & DECENTRALIZED SYSTEMS BOARD                                           |
|    - Focus: Candidate scoring (0-15), protocol integrations, KB playbooks.        |
|    - Views: Scored Candidate Matrix, Protocol Domain, SLA Tiering.                 |
+-----------------------------------------------------------------------------------+
```

### 2.1 Custom Fields in GitHub Projects
- **Candidate Score** (Number, 0–15): Aggregate score based on Maturity (1–5), Mobile-Friendliness (1–5), and Security (1–5).
- **Protocol Domain** (Single Select): `Bitcoin L1/L2`, `Off-Chain Scaling`, `Sovereign Assets`, `Interoperability`, `Staking/Proofs`, `State/Hardware`.
- **SLA Tier** (Single Select): `Tier 1 Public Core (No SLA)` / `Tier 2 Enterprise Gateway (Paid SLA)`.
- **KB Article Link** (Text): Relative path to corresponding Knowledge Base playbook in `docs/kb/`.

---

## 3. Initiative Scoring & Promotion Lifecycle

Initiatives tracking decentralized protocols follow a 4-phase lifecycle:

```
[ PHASE 1: RESEARCH ] ----> [ PHASE 2: SCORED ] ----> [ PHASE 3: CONTAINED ] ----> [ PHASE 4: PRODUCTION ]
- Protocol evaluation.     - Candidate score      - Gated in wallet via       - Verified on mainnet.
- Open Issue via template.   assigned (0-15).       Issue #444 verifier.        - Published KB guide.
```

### 3.1 Candidate Scoring Thresholds
- **Score 14–15 (Production Candidate)**: Protocol logic complete, fail-closed guards tested, native managers integrated (e.g., Ark V-UTXO PRF via BouncyCastle, Agnostic Hardware SDK).
- **Score 12–13 (In Progress / Hardened)**: Core bridge wired, mobile performance optimizations underway (e.g., Liquid Confidentiality, Silent Payments JNI, FDC3 Intent handling).
- **Score 10–11 (Research / Quarantined)**: Protocol in containment queue or stubbed simulation (e.g., BitVM2 verifier envelope, RGB ALU simulation, Taproot Assets discovery).
- **Score < 10 (Deferred)**: Unrated or non-viable for mobile enclave environments.

---

## 4. GitHub Issue & Knowledge Base Integration Workflow

When creating or working on an issue:
1. **Issue Creation**: Open issue using `.github/ISSUE_TEMPLATE/nexus_decentralized_system.yml`.
2. **Project Assignment**: Add issue to **Nexus & Decentralized Systems Board**.
3. **Field Population**: Set **Protocol Domain**, **Candidate Score**, and **SLA Tier**.
4. **Knowledge Base Linking**: If the issue resolves an operational problem, author/update a Knowledge Base article in `docs/kb/` and link it in the issue description.
5. **Closure & Verification**: Issue closure requires running `pnpm run verify` locally and verifying that the KB article is indexed in `docs/kb/README.md` and `docs/README.md`.

---

*Operational guide enforced across all Conxian repository contributors.*
