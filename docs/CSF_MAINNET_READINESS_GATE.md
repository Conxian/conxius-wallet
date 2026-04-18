---
title: CSF Mainnet Readiness Gate
layout: page
permalink: /docs/csf-readiness
---

# ConxianCSF Mainnet Readiness Gate (CON-129)

This document tracks the final launch readiness for ConxianCSF mainnet deployment.

## 🚀 Launch Checklist

### 1. Protocol & Contracts
- [x] Stacks Bridge (Clarity 4.0) verified for Mainnet.
- [x] Ark V-UTXO contract (Clarity 4.0) verified for Mainnet.
- [x] Revenue Automation (1% fee) implemented and tested.
- [x] DLC Orchestrator implemented for bond lifecycle.
- [x] Referral Aggregator (5-5-5 logic) implemented and tested.

### 2. Signer & Wallet Security
- [x] Enclave-backed signing integrated for all major layers.
- [x] Multi-sig threshold defaults aligned with SAB wallet model.
- [x] SPV header verification logic implemented.

### 3. Gateway & Infrastructure
- [x] Bitcoin RPC defaults to PublicNode for Mainnet.
- [x] ZKML verification logic integrated for CARF/BRS compliance.
- [x] OData v4 translation layer implemented.
- [x] 144-block time-lock enforced for external triggers in TEE.

### 4. Release Hygiene
- [x] Version v1.6.0 pinned across all relevant repositories.
- [x] READMEs updated with Purpose and Status sections.
- [x] Principal cutover (ST -> SP) complete in configuration.
- [x] LICENSE (MIT) added to root directory.
- [x] Placeholder strings and testnet residue remediated in `services/`.
- [x] Independent Verification Pathway (CON-346) documented.
- [x] Community Funding Model (CON-137) and Bounty Classification (CON-231) documented.

## 🛡️ Go/No-Go Decision Status: [GO]

### Final Audit Notes (CON-399/386/393)
- Redaction scanner statefulness fixed (CON-305).
- COO approval path integrated (CON-224).
- Stacks principals validated; all testnet ST... remnants purged from production services.
- Protocol vault SP3FBR... configured as canonical sBTC token principal in NTT.

As of April 18, 2026, all critical launch blockers for ConxianCSF are resolved.

---
*Updated: April 18, 2026*
