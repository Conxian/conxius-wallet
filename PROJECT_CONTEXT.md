# Conxius Wallet: Project Context

**Last Updated:** 2026-02-15
**Context:** B2B Alignment & Conxian Gateway Integration

---

## 🛡️ The Citadel (Mobile Core)
Conxius is an Android-first, TEE-backed sovereign interface for the Bitcoin ecosystem. It handles all private key operations within the "Conclave."

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
- **Frontend**: React 19 + Vite 7 + Tailwind 4.
- **Native**: SecureEnclavePlugin (TEE), BreezPlugin (Lightning).
- **Gateway**: Next.js (Static Export) - see `/conxian-ui`.

## 🧪 Verification
- All root `tests/` pass.
- B2B alignment tests pass.
- Gateway deployment configuration fixed (`npx serve out`).

