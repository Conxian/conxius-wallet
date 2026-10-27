# Knowledge Base Guide: Nexus & Decentralized Systems Integration

**Article ID:** KB-NEXUS-2026-001
**Category:** Protocol Integration / Operations / Security
**Version:** 1.9.5
**Audience:** Protocol Engineers, Node Operators, Integrators
**SLA Coverage:** Tier 1 Core (Self-Service) / Tier 2 Gateway (SLA Guaranteed)

---

## 1. Overview & Architectural Context

This Knowledge Base (KB) guide provides step-by-step operational instructions and integration specifications for deploying, configuring, and leveraging **Conxian Nexus (`conxian-nexus`)** alongside external decentralized protocols.

Nexus acts as the sovereign state layer, canonical indexer, and state-proof engine across the Conxian platform.

---

## 2. KB Playbooks & Integration Specs

### KB-001: Integrating Nexus BFF as Primary State Provider

#### Problem
Mobile clients directly querying public Bitcoin indexers suffer from RPC rate limits, inconsistent block tip height, and untrusted state formatting.

#### Solution & Architecture
Configure clients to prioritize the Nexus BFF (`services/protocol.ts`) under the **Nexus-First** state model.

```typescript
// Example: Resolving state via Nexus BFF in services/protocol.ts
import { ProductionRuntimeGuard } from './production-guard';

export async function fetchCanonicalState(endpointUrl: string): Promise<CanonicalState> {
  // Fail-closed runtime guard for production environments
  if (!endpointUrl || !endpointUrl.startsWith('https://')) {
    ProductionRuntimeGuard.failClosed('Invalid Nexus Gateway URL');
  }

  const response = await fetch(`${endpointUrl}/v1/nexus/state/canonical`);
  if (!response.ok) {
    throw new Error(`Nexus state sync failed: ${response.statusText}`);
  }
  return await response.json();
}
```

---

### KB-002: Ark V-UTXO PRF Derivation & ASP Batching

#### Problem
Inconsistent PRF derivation between Kotlin client engines and Rust/WASM ASP servers causes V-UTXO index mismatch during off-chain pool renewal rounds.

#### Solution & Specification
Enforce native `Blake2sDigest` derivation via BouncyCastle (`org.bouncycastle:bcprov-jdk18on`) in `ArkManager.kt`.

```kotlin
// Native Kotlin PRF derivation matching arkworks spec
import org.bouncycastle.crypto.digests.Blake2sDigest

fun deriveVutxoIndex(seed: ByteArray, index: Long): ByteArray {
    val digest = Blake2sDigest(256) // 32-byte output
    digest.update(seed, 0, seed.size)
    val indexBytes = ByteBuffer.allocate(8).putLong(index).array()
    digest.update(indexBytes, 0, indexBytes.size)
    val out = ByteArray(32)
    digest.doFinal(out, 0)
    return out
}
```

---

### KB-003: BitVM2 Dispute Watchtower & Quarantine Gate Operations

#### Problem
Mobile devices lack compute capacity to run full SNARK/STARK verifier loops across the 364-tap BitVM2 verification tree.

#### Solution & Gate Containment
Nexus monitors challenge transactions on-chain and evaluates proof segments against the 364-tap floor. When a dispute is detected:
1. Nexus places the transaction into the **Issue #444 Gate Containment Queue**.
2. Nexus emits a typed authorization alert to the client enclave.
3. The client reviews the quarantine payload and signs the dispute transaction via native Keystore.

---

### KB-004: Agnostic Hardware SDK Attestation Workflow

#### Problem
Heterogeneous device environments (Android StrongBox, iOS Secure Enclave, Desktop TPM 2.0, Server Nitro Enclaves) require uniform attestation verification before authorizing high-value protocol operations.

#### Solution
Utilize `AgnosticHardwareSurfaceRegistry` in `services/enclave-storage.ts` to query surface capabilities and verify hardware attestation tokens:

```typescript
import { AgnosticHardwareSurfaceRegistry, HardwareSurfaceType } from './enclave-storage';

const registry = AgnosticHardwareSurfaceRegistry.getInstance();
const primarySurface = await registry.getPrimarySurface();

if (primarySurface.type === HardwareSurfaceType.STRONGBOX) {
  const attestationToken = await primarySurface.generateAttestationToken(challenge);
  // Submit token to Nexus for backend remote key verification
  await verifyRemoteAttestation(attestationToken);
}
```

---

### KB-005: Liquid Confidential Address & Blinding Guard Setup

#### Problem
Transacting confidential assets on Liquid without verifying blinding keys leads to unblinded transaction leaks or failed confidential transfers.

#### Solution
Use `services/liquid.ts` helper utilities with `ProductionRuntimeGuard` safety checks:

```typescript
import { parseConfidentialAddress, ProductionRuntimeGuard } from './liquid';

export function prepareLiquidTransfer(address: string) {
  const parsed = parseConfidentialAddress(address);
  if (!parsed.isConfidential) {
    ProductionRuntimeGuard.failClosed('Guard: Liquid transaction requires confidential address');
  }
  return parsed.blindingKey;
}
```

---

## 3. Operational Troubleshooting Guide

| Issue / Error | Root Cause | Remediation Steps |
| :--- | :--- | :--- |
| `Guard: Phase 6 Nexus Sync Failed` | Gateway URL is non-HTTPS or Nexus state proof signature mismatch. | 1. Check `VITE_NEXUS_GATEWAY_URL` in `.env`.<br>2. Ensure URL uses TLS (`https://`).<br>3. Verify endpoint health via `GET /health`. |
| `unsupported_provider` | Transaction path intercepted by Issue #444 Value Operation Gate. | The requested value operation is contained and pending production verifier qualification. Do not force broadcast. |
| `Blake2s PRF Mismatch` | Non-deterministic seed or fallback to SHA-256 in legacy client. | Ensure `ArkManager.kt` uses BouncyCastle `Blake2sDigest` and client is updated to v1.9.5+. |
| `Attestation Rejected` | KeyMint token challenge expired or Play Integrity token invalid. | Re-acquire challenge nonce from Nexus BFF and retry hardware attestation sequence. |

---

*Official KB Guide maintained by Conxian Labs.*
