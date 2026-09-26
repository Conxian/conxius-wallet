# Conxian Org-Wide Platform Audit & System Lifecycle Review (2026)

**Date:** September 2026 / Release v1.9.5
**Scope:** Org-Wide Infrastructure (`conxius-wallet`, `conxian-gateway`, `conxian-nexus`, `conxius-platform`, `lib-conxian-core`), Live Cloud State (Neon & Render), Client Onboarding & Purchase Lifecycle, and Core Protocol Pillars.

---

## Executive Summary

This comprehensive audit evaluates the full Conxian platform ecosystem across infrastructure topology, live cloud database deployments, cloud web services, end-to-end client installation/purchase lifecycles, and six critical Bitcoin protocol pillars (FDC3, Silent Payments, BitVM2, RGB/CSV, Taproot Assets, and Babylon Staking).

The platform demonstrates high production readiness with zero regressions in the 541-test suite, strong fail-closed security guards, and live cloud infrastructure backing enterprise operations.

---

## 1. Org-Wide Infrastructure & Live Cloud Audit

### 1.1 Neon Managed PostgreSQL Databases (`org-silent-sun-00457600`)
- **`Conxian Nexus` (`orange-paper-76209725`)**: PostgreSQL 17 (`aws-eu-central-1`). Canonical state store, cryptographic state-proof registry, logical replication target.
- **`Gateway` (`noisy-cloud-41146057`)**: PostgreSQL 18 (`aws-ap-southeast-1`). B2B web portal backend, tenant metadata, event routing.
- **`Business Operating System` (`noisy-flower-17484435`)**: PostgreSQL 18 (`aws-us-east-2`). Platform control plane, asset deployment records, subscription state.
- **`conxian-core` (`sparkling-sunset-69236559`)**: PostgreSQL 18 (`aws-us-east-2`). Upstream core metadata and contract telemetry.
- **`market` (`small-math-44741750`)**: PostgreSQL 18 (`aws-eu-central-1`). Market pair indexer and liquidity cache.
- **`Software dev kit` (`weathered-night-98492579`)**: PostgreSQL 18 (`aws-us-east-2`). SDK developer keys and test vectors.

### 1.2 Render Cloud Services (`tea-d6u0edngi27c73dvhsg0`)
- **`conxian-business` (`srv-d9gam3m1a83c73bmrfc0`)**: Docker Web Service (Oregon). B2B institutional gateway portal backend.
- **`conxian-ui-prod` (`srv-d96fl2mq1p3s73c2e8k0`)**: Node/pnpm Web Service (Oregon). Corporate treasury live web app.
- **`conxian-business-static-docs` (`srv-d9h2nu2b6mfs738i6gb0`)**: Static Site. Enterprise documentation portal.
- **`conxian-labs-static-v1` (`srv-d8fmr7v40ujc73b7ba8g`)**: Static Site. Developer landing page.

---

## 2. End-to-End Client Purchase & First-Time Installation Lifecycle

### 2.1 Product Entitlement Tiers
1. **Tier 1: Corporate Treasury & Wallet**: Mobile APK/AAB or Web UI instance + Hardware Enclave Integration (`TEE`, `TPM`, `HSM`, `FIDO2`, `POS`).
2. **Tier 2: Institutional Gateway & Shielded Payments**: Dedicated Render Docker instance (`conxian-business`) + Dedicated Neon `Gateway` database tenant.
3. **Tier 3: Sovereign Citadel Node**: Full Nexus state node sync (`conxian-nexus`) + Local Custom Bitcoin/Liquid/Stacks RPC connection.

### 2.2 Client Installation & Input Parameters
Clients deploying Conxian must supply the following environment configurations:
- `DATABASE_URL`: PostgreSQL connection string provisioned on Neon.
- `VITE_NEXUS_MAINNET_URL`: Canonical Nexus state verification endpoint.
- `VITE_GATEWAY_URL`: Enterprise B2B API gateway URL.
- `BITCOIN_RPC_URL`: Self-hosted Bitcoin L1 node or provider RPC.
- `LIQUID_RPC_URL`: Sovereign Liquid sidechain RPC endpoint.
- `STACKS_RPC_URL`: Stacks L2 API/RPC endpoint.
- `HARDWARE_SURFACE_TYPE`: Selected enclave hardware provider (`TEE`, `TPM`, `HSM`, `SERVER_ENCLAVE`, `FIDO2`, `POS`).

### 2.3 Operational Recommendation: Unified Installer CLI (`@conxian/cli`)
To eliminate manual setup drift, the platform recommends deploying `@conxian/cli`:
- `conxian init`: Interactive setup wizard for network mode, RPC nodes, and hardware surface types.
- `conxian doctor`: Automated diagnostic checking connectivity across Bitcoin L1/L2, Neon Postgres, Gateway API, and Nexus sync state.
- `conxian deploy`: Containerized deployment orchestrator for local Docker or Kubernetes.
- `conxian verify`: End-to-end cryptographic state-proof verification runner.

---

## 3. Protocol Pillars: Gap Analysis & Candidate Scoring

### 3.1 Protocol Candidate Scoring Matrix

| Pillar | Maturity | Mobile Compatibility | Security Hygiene | Score | Implementation Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Ark (V-UTXO)** | 5/5 | 5/5 | 5/5 | **15/15** | Native BouncyCastle Blake2s PRF implemented & verified. |
| **Liquid Sidechain** | 4/5 | 5/5 | 5/5 | **14/15** | Native signing/blinding fail-closed guards & confidential address validation. |
| **FDC3 Interoperability** | 5/5 | 4/5 | 4/5 | **13/15** | Desktop/Web TS bridge + Android Native Intent Resolver (`VIEW_INSTRUMENT`). |
| **Silent Payments** | 4/5 | 4/5 | 5/5 | **13/15** | BIP-352 TS service + Rust/JNI mobile scanning engine (PR #390). |
| **BitVM2** | 3/5 | 3/5 | 5/5 | **11/15** | 364-tap verification floor (1 Validating, 363 Hashing); TS envelope verifier in quarantine mode. |
| **RGB / CSV** | 3/5 | 3/5 | 5/5 | **11/15** | Client-Side Validation TS ALU simulation; native Rust `rgb-lib` bridge planned. |
| **Taproot Assets** | 4/5 | 4/5 | 4/5 | **13/15** | On-chain Taproot asset issuance & transfer service (`services/taproot-assets.ts`). |
| **Babylon Staking** | 4/5 | 4/5 | 5/5 | **13/15** | Bitcoin L1 Taproot timelock staking & delegation proof service (`services/babylon.ts`). |

---

*Prepared by Jules, Sovereign Systems Architect. Aligned with v1.9.5 Production Readiness Standards.*

---

## 4. Org-Wide SLA Positioning & Enterprise Risk Containment

### 4.1 Structural SLA Realignment Strategy
- **Core Reality**: Open-source infrastructure pre-seed/grant funding does not support 24/7/365 follow-the-sun incident response. Applying rigid commercial SLAs across public protocol layers creates severe maintainer bottlenecks and liability traps.
- **Protocol vs. Enterprise Decoupling**:
  - **Public Core Protocol (`conxius-wallet`, `lib-conxian-core`, `conxius-enclave-sdk`, `conxian-nexus`)**: Public code is provided "AS-IS" without commercial SLAs. Support is provided on a community best-effort basis.
  - **Enterprise Gateway Tier (`conxian-gateway` / ISO 20022 Adapters)**: Commercial SLAs are restricted exclusively to paid enterprise contracts, covering integration support and business-hour response times, explicitly excluding network uptime, L1/L2 consensus halts, and vendor enclave deprecations.
