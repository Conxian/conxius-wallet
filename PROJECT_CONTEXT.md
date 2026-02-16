# Conxius Wallet: Project Context

**Last Updated:** 2026-02-16
**Context:** Unified Protocol Enhancements

---

## 🛡️ The Citadel (Mobile Core)

Conxius is an Android-first, TEE-backed sovereign interface for the Full Bitcoin Ecosystem (BTC, L2, Sidechains, RGB, Ark, BitVM). It handles all private key operations within the "Conclave."

## 🚀 The Gateway (B2B Expansion)

The **Conxian Gateway** is the institutional expansion layer for Conxius. It is a standalone web app (hosted as a standalone app under Conxian Labs) that provides:

- **Corporate Treasury**: Advanced DEX and liquidity management.
- **B2B Shielded Payments**: Privacy-focused enterprise transactions.
- **Institutional Launchpad**: Token issuance for businesses.

---

## 🔄 Alignment Status (Verified)

### Integrated Components

- **Web3Browser**: Conxian Gateway is the featured B2B Portal.
- **DeFiDashboard**: Direct link to Gateway for institutional liquidity.
- **LabsExplorer**: Conxian Gateway is a flagship "LIVE" incubator project.
- **Settings**: Corporate Profile enhanced for Gateway compatibility.

### Documentation Synced

- **PRD.md**: Defines B2B role of the Gateway.
- **ROADMAP.md**: Includes B2B milestones.
- **IMPLEMENTATION_REGISTRY.md**: Tracks Gateway as a production feature.
- **AGENTS.md**: Guides AI agents on the Conxius-Gateway relationship.

---

## 🔧 Technical State
- **Hardening**: Zero-Leak memory enforcement (.fill(0)) in all cryptographic modules.

- **Frontend**: React 19 + Vite 7 + Tailwind 4.
- **Native**: SecureEnclavePlugin (TEE), BreezPlugin (Lightning).
- **Gateway**: Next.js (Static Export) - see `/conxian-ui`.

## 🧪 Verification

- **All Tests Passed**: 145/145 unit & integration tests (Vitest).
- **B2B Alignment**: Verified via component checks.
- **Gateway**: Deployment configuration fixed (`npx serve out`).

## 🌐 Full Bitcoin Ecosystem Alignment

- **Enclave**: Support for BIP-340 Schnorr signing (RGB/Ark) and multi-protocol WYSIWYS verification.
- **Protocols**:
  - **Ark**: VTXO lifecycle (Forfeiture & Redemption) fully integrated.
  - **RGB**: Consignment structure & on-chain anchor verification established.
  - **BitVM**: Functional cryptographic proof verification live.
  - **State Chains**: Transfer API with coordinator sync fully implemented.
  - **Maven**: Multi-asset fetcher and transfer preparation fully implemented with sequential derivation support (m/84'/0'/0'/3/${index}).
- **Identity**: Enclave-backed Web5 KeyManager for sovereign DIDs.
