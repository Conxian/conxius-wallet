# Conxian Org-Wide System Installation, Setup & Client Onboarding Guide

**Version:** v1.9.5
**Date:** June 2026 / September 2026
**Status:** APPROVED / PRODUCTION READY
**Scope:** Org-Wide System Architecture (`conxius-wallet`, `conxian-gateway`, `conxian-nexus`, `conxius-platform`, `lib-conxian-core`) & Live Cloud Infrastructure (Neon, Render)

---

## 1. Executive Overview & Architecture Topology

The Conxian Ecosystem is an enterprise-grade, multi-chain sovereign financial platform for the full Bitcoin landscape (L1 BTC, Lightning, Liquid, Stacks, RSK, BOB, RGB, Ordinals, Runes, Ark, BitVM2, State Chains, and Maven).

The platform architecture spans four primary operational tiers:
1. **Conxius Mobile & Web Client (`conxius-wallet` / `conxian-ui`)**: Non-custodial sovereign wallet interface backing keys into native hardware enclaves (Android Keystore / TEE / StrongBox fallback, Desktop TPM 2.0, PKCS#11 HSM, FIDO2/Passkeys, and POS terminals via `AgnosticHardwareSurfaceRegistry`).
2. **Conxian Gateway (`conxian-gateway` / `noisy-cloud-41146057`)**: Core enterprise event bus, B2B portal backend, and API routing tier hosted on Cloud Web Services and backed by Neon Postgres (`Gateway` project).
3. **Conxian Nexus (`conxian-nexus` / `orange-paper-76209725`)**: Sovereign state validation layer responsible for canonical block state, cryptographic proof generation, and mainnet sync enforcement (`PHASE6_NEXUS_SYNC_ENFORCEMENT_ENABLED`).
4. **Control-Plane & Business Operating System (`conxius-platform` / `noisy-flower-17484435`)**: Private governance operational surface managing release governance (`/admin/releases`), audit logs (`/admin/audit`), policy approval queues (`/admin/policies`), and environment registries (`/admin/registry`).

---

## 2. Live Cloud Infrastructure Mapping

### 2.1. Neon Managed Databases (`org-silent-sun-00457600`)
- **`Conxian Nexus`** (`orange-paper-76209725` | PG 17 | `aws-eu-central-1`): Canonical state store, state-proof registry, and logical replication target.
- **`Gateway`** (`noisy-cloud-41146057` | PG 18 | `aws-ap-southeast-1`): B2B web portal, audit logs, client tenant metadata, and event routing.
- **`Business Operating System`** (`noisy-flower-17484435` | PG 18 | `aws-us-east-2`): Platform control-plane registry, asset deployment records, and billing/subscription state.
- **`conxian-core`** (`sparkling-sunset-69236559` | PG 18 | `aws-us-east-2`): Upstream cryptographic core metadata and contract telemetry.
- **`market`** (`small-math-44741750` | PG 18 | `aws-eu-central-1`): Market pair, liquidity indexer, and trade routing cache.
- **`Software dev kit`** (`weathered-night-98492579` | PG 18 | `aws-us-east-2`): SDK telemetry, developer keys, and test vectors.

### 2.2. Render Cloud Hosting (`tea-d6u0edngi27c73dvhsg0`)
- **`conxian-business`** (`srv-d9gam3m1a83c73bmrfc0` | Web Service | Docker | Oregon): B2B institutional gateway portal.
- **`conxian-ui-prod`** (`srv-d96fl2mq1p3s73c2e8k0` | Web Service | Node / pnpm | Oregon): Live web interface for corporate treasury.
- **`conxian-business-static-docs`** (`srv-d9h2nu2b6mfs738i6gb0` | Static Site): Enterprise documentation portal.
- **`conxian-labs-static-v1`** (`srv-d8fmr7v40ujc73b7ba8g` | Static Site): Public developer landing page.

---

## 3. End-to-End Client Purchase & Installation Lifecycle

When an enterprise client purchases the Conxian Platform, the deployment process consists of 4 distinct steps:

```
+---------------------+     +----------------------+     +-----------------------+     +---------------------+
| 1. Purchase & Tier  | --> | 2. Provisioning &    | --> | 3. Environment & Key  | --> | 4. Verification &   |
|    Selection        |     |    Deployment        |     |    Input Configuration|     |    Asset Connection |
+---------------------+     +----------------------+     +-----------------------+     +---------------------+
```

### Step 1: Client Purchase & Module Entitlement
Clients purchase licenses based on their operational tier:
- **Tier 1: Corporate Treasury & Wallet**: Mobile APK/AAB or Web UI instance + Hardware Enclave Integration.
- **Tier 2: Institutional Gateway & Shielded Payments**: Dedicated Render Docker instance (`conxian-business`) + Dedicated Neon `Gateway` database tenant.
- **Tier 3: Sovereign Citadel Node**: Full Nexus state node sync (`conxian-nexus`) + Local Custom Bitcoin/Liquid/Stacks RPC connection.

### Step 2: Provisioning & Deployment Workflow
Clients receive access to provisioned infrastructure or deploy on-premise:
1. **Database Provisioning**: Database connection strings are provisioned on Neon (`DATABASE_URL`).
2. **Backend Services**: `conxian-gateway` container deployed via Render or Kubernetes.
3. **State Sync**: `conxian-nexus` service initialized with mainnet sync enabled (`VITE_NEXUS_MAINNET_URL`).

### Step 3: Required Client Inputs & Configuration Parameters
Client administrators configure their environment variables:

| Variable | Scope | Description | Required Input / Source |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Gateway / BOS | PostgreSQL connection string | Provisioned via Neon Console / API |
| `VITE_NEXUS_MAINNET_URL` | Client / Wallet | Canonical Nexus state verification endpoint | `https://nexus.conxianlabs.com` |
| `VITE_GATEWAY_URL` | Client / Wallet | Enterprise B2B API gateway URL | `https://conxian-business.onrender.com` |
| `BITCOIN_RPC_URL` | Nexus / Gateway | Sovereign Bitcoin L1 RPC endpoint | Client self-hosted node or QuickNode/Blockstream |
| `LIQUID_RPC_URL` | Nexus / Gateway | Sovereign Liquid sidechain RPC endpoint | Client self-hosted Elements node |
| `STACKS_RPC_URL` | Nexus / Gateway | Stacks L2 API/RPC endpoint | Client self-hosted or Hiro API endpoint |
| `HARDWARE_SURFACE_TYPE` | Wallet Enclave | Key storage enclave provider | `TEE`, `TPM`, `HSM`, `SERVER_ENCLAVE`, `FIDO2`, `POS` |

---

## 4. Operational Recommendation: Unified CLI & Installer (`conxian-cli`)

To streamline client setup and eliminate manual configuration drift, we recommend establishing `@conxian/cli` as the unified installation toolchain:

### Recommended CLI Commands (`npx @conxian/cli init`)
- **`conxian init`**: Interactive setup wizard prompting for network mode (Mainnet / Testnet / Regtest), RPC nodes, and Hardware Enclave providers.
- **`conxian doctor`**: Diagnostic tool checking connectivity across Bitcoin RPC, Liquid RPC, Stacks RPC, Gateway API, Neon Postgres, and Nexus sync state.
- **`conxian deploy`**: Orchestrates local Docker Compose or cloud Kubernetes deployment of Gateway + Nexus stack.
- **`conxian verify`**: Executes end-to-end cryptographic state-proof verification across connected assets.

---

*Verified by Sovereign Architect Agent. Aligned with v1.9.5 Production Readiness Audit.*
