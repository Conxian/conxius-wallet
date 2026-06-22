# PROJECT CONTEXT (June 2026)

**Current Status:** v1.9.2 Protocol Expansion
**Active Research:** BitVM2, Ark, FDC3, AI Security

## 1. Executive Summary
Conxius Wallet is a sovereign-first mobile wallet leveraging a Bridged Sovereign Architecture. We are currently expanding support for institutional interoperability (FDC3) and advanced Bitcoin Layer 2 protocols (BitVM2, Ark).

## 2. Technical Milestones (v1.9.2)
- **FDC3 Native Bridge**: Bridged TypeScript FDC3 calls to Native Android Intents (`services/fdc3.ts` -> `Fdc3Plugin.kt`).
- **BitVM2 Orchestration**: Implemented the 364-tap verification floor in `services/bitvm.ts` for Groth16 optimistic proof verification.
- **Ark V-UTXO Management**: Aligned `ArkManager.kt` with deterministic Blake2s PRF derivation logic.
- **AI Security**: Implemented outgoing prompt sanitization and ZWC normalization in `services/ai-security.ts`.

## 3. Active Gaps & Research
- **Native Rust Worker**: Transitioning BitVM2 segmentation and Blake2s PRF from mocks to high-performance Rust FFI.
- **RGB Light Client**: Researching pruned validation proofs for client-side validation on mobile devices.
- **Taproot Asset Light Client**: Porting verification logic to `BdkManager.kt`.

## 4. CI/CD & Governance
- **Hardening**: Pinned pnpm to `10.30.3`. Pinned GitHub Actions to stable SHAs.
- **Security**: Gitleaks and GitGuardian integrated for secret scanning.
- **Fail-Closed**: `ProductionRuntimeGuard.kt` enforces security for non-production paths.

---
*Updated: June 22, 2026*
