# CON-1544: Android KeyMint / StrongBox authorization boundary

**Status:** Client-side collection and request binding implemented; backend
qualification, authorization enforcement, and independent release evidence
remain open.

**Reviewed:** 2026-07-22 against current `main` commit
`0b6757711df80824b932a32e91947064659199d6` (after merged PRs #441, #442, and
#443).

**Canonical tracker:** [CON-1544](https://linear.app/conxian-labs/issue/CON-1544/p0-qualify-android-keymintstrongbox-authorization-and-play-integrity)

This report is the public-safe boundary and qualification plan for the Android
KeyMint/StrongBox and Google Play Integrity work. It records what the wallet
collects and binds locally, what a trusted backend must verify, what a future
value-operation gate must enforce, and what remains outside the delivered
protocol-key custody boundary.

## Executive summary

The merged implementation establishes two client-side seams:

1. PR #441 adds a dedicated P-256/ECDSA Android Keystore authorization key,
   typed local KeyMint evidence, fail-closed `STRONGBOX_REQUIRED`/
   `TEE_ALLOWED` policy evaluation, and deterministic request binding.
2. PR #442 adds Google Play Integrity Standard API `1.6.0` provider preparation
   and opaque-token acquisition. The canonical request hash is passed through
   unchanged; the app does not decode or trust the token.

Those seams are **not** a hardware qualification, a backend attestation
verifier, a production authorization decision, or proof that protocol signing
keys are StrongBox-backed. The P0 exit gate stays open until real-device
evidence, server verification, durable freshness/replay policy, centralized
value-operation enforcement, privacy-minimized telemetry, staged rollout and
rollback procedures, and independent review are complete.

## Boundary model

| Boundary | Delivered on the wallet side | Still required before release authorization |
| --- | --- | --- |
| **Collection** | Creates or inspects a separate non-exportable P-256 authorization key; returns public key, certificate-chain bytes, key identity, package/signing identity, and local `KeyInfo` evidence. Requests an opaque Standard API Play Integrity token. | Capture signed evidence from a real-device matrix, preserve provenance, and define retention/redaction rules. |
| **Request binding** | Versioned, length-prefixed SHA-256 binding covers operation digest, nonce, KeyMint challenge, key identity, package name, signing-certificate identity, and policy. A URL-safe unpadded Base64 transport form is available. | Recompute the exact same canonical bytes/hash on the backend and reject mismatches, missing fields, altered package identity, stale timestamps, or challenge/operation correlation failures. |
| **Backend verification** | None. Play Integrity tokens remain opaque on-device. | Verify Android Key Attestation chains, trust roots, revocation, challenge, app identity, security level, boot state, patch state, and policy. Decrypt/verify the Play Integrity token on a trusted server and validate its request details and verdicts. |
| **Authorization enforcement** | Local policy evaluation rejects software, unknown, unavailable, unsupported, or non-StrongBox evidence under the applicable policy. This is evidence classification, not a wallet value-operation gate. | A centralized server-backed gate must make the allow/quarantine/reject decision for value operations, fail closed on missing or stale evidence, and prevent bypass through alternate protocol entry points. See [CON-1546](https://linear.app/conxian-labs/issue/CON-1546/p0-add-centralized-wallet-value-operation-gate-and-quarantine). |
| **Protocol-key custody** | The new P-256 key is separate from existing AES seed/database storage and has no signing method in this slice. | Independently prove custody and authorization for each protocol signing path. Do not infer Bitcoin/Stacks/secp256k1/Schnorr hardware qualification from this P-256 evidence. |

## Implemented evidence

### PR #441 — KeyMint policy, evidence, and canonical binding

[PR #441](https://github.com/Conxian/conxius-wallet/pull/441) merged on
2026-07-22. It delivered:

- `KeySecurityTier` values for explicit StrongBox, trusted environment,
  software, unknown, and unsupported evidence.
- Fail-closed `AuthorizationPolicy.STRONGBOX_REQUIRED` and
  `AuthorizationPolicy.TEE_ALLOWED` evaluation.
- A dedicated P-256/ECDSA authorization key with an Android KeyMint
  attestation challenge; the private key is not exported and no signing API was
  added.
- Explicit trusted-environment fallback only for `TEE_ALLOWED`; a
  StrongBox-required request never silently downgrades.
- Canonical request binding for operation digest, nonce, attestation challenge,
  key identity, package/signing identity, and policy.
- Public-safe local evidence only; no private key, mnemonic, or protocol
  signing material is returned.

### PR #442 — Play Integrity Standard API client boundary

[PR #442](https://github.com/Conxian/conxius-wallet/pull/442) merged on
2026-07-22. It delivered:

- The official Google Play Integrity SDK `1.6.0` dependency.
- Configured Cloud-project validation and cached Standard API provider
  preparation.
- Exact pass-through of the canonical request hash to the SDK.
- Opaque token return without client-side decryption, verdict inspection,
  logging, local trust decisions, or wallet-operation gating.

### Current-main hardening: PR #443

[PR #443](https://github.com/Conxian/conxius-wallet/pull/443) is now merged into
current `main`. Its hardening changes are recorded here as wallet-side
implementation detail only; they do **not** qualify real-device hardware, a
backend verifier, production authorization, or protocol signing keys.

- Authorization aliases use the manager-owned
  `ConxiusAuthorizationKey.v1.` namespace; wallet seed/database aliases are
  rejected before inspection.
- Attestation challenges are bounded to 1–128 bytes before key generation or
  inspection.
- Accepted keys prove the manager profile: EC `secp256r1` (P-256), 256-bit
  size, exact `PURPOSE_SIGN`, exact SHA-256 digest authorization, and
  X.509 leaf-certificate/public-key consistency. Existing keys that cannot
  prove that profile fail closed with stable profile reasons.
- A `TEE_ALLOWED` StrongBox request falls back only for the explicit Android
  `StrongBoxUnavailableException`, and the returned path includes the
  `strongbox_unavailable` reason code. Malformed challenges, evidence
  inspection failures, and other provider failures do not retry. A
  `STRONGBOX_REQUIRED` request never takes that fallback.
- `SECURITY_LEVEL_UNKNOWN_SECURE` remains an unknown tier. It is not silently
  promoted to StrongBox or trusted-environment evidence.

Unknown or unavailable local evidence is rejected before it can be returned as
policy-accepted authorization evidence. The client does not make an
authorization decision from a Play Integrity token or a web fallback; the
token remains opaque until a trusted backend verifies it.

These implementation details do not close the qualification blockers, backend
verification checklist, centralized value-operation gate, or P0 exit gate
documented below.

### Implementation references

- `android/core-crypto/src/main/kotlin/com/conxius/wallet/crypto/KeySecurityPolicy.kt`
- `android/core-crypto/src/main/kotlin/com/conxius/wallet/crypto/KeyMintAuthorizationManager.kt`
- `android/core-crypto/src/main/kotlin/com/conxius/wallet/crypto/AuthorizationRequest.kt`
- `android/app/src/main/kotlin/com/conxius/wallet/PlayIntegrityPlugin.kt`
- `android/core-crypto/src/main/kotlin/com/conxius/wallet/crypto/StrongBoxManager.kt`
- `android/core-crypto/src/test/kotlin/com/conxius/wallet/crypto/KeySecurityPolicyTest.kt`
- `android/core-crypto/src/test/kotlin/com/conxius/wallet/crypto/KeyMintAuthorizationManagerTest.kt`
- `android/core-crypto/src/test/kotlin/com/conxius/wallet/crypto/AuthorizationRequestCanonicalizerTest.kt`
- `android/app/src/test/kotlin/com/conxius/wallet/PlayIntegrityPluginTest.kt`

## StrongBox boundaries that must not be conflated

### Legacy AES seed/database storage

`StrongBoxManager` owns the existing AES seed/database encryption path. It
requests StrongBox when the platform reports support, but its generation error
path creates a TEE-backed key. Its pre-API-31 `isInsideSecureHardware` check is
not a StrongBox proof. This legacy storage behavior is unchanged by PRs #441
and #442.

### Dedicated P-256 KeyMint authorization key

`KeyMintAuthorizationManager` is a separate authorization-evidence boundary.
On API 31 and newer it can classify the explicit Android Keystore security
level; on API 26–30, `isInsideSecureHardware` is mapped only to a generic
trusted environment and never promoted to StrongBox. `STRONGBOX_REQUIRED`
rejects that legacy evidence. `TEE_ALLOWED` can accept trusted-environment
evidence, subject to future backend and release policy.

### Protocol signing is not hardware-qualified by this work

The P-256 authorization key is not wired into wallet unlock, Bitcoin or Stacks
signing, secp256k1/Schnorr operations, or a production value-operation gate.
The presence of an Android Keystore certificate chain or a Play Integrity token
does not prove that any protocol signing key is hardware-backed, authorized for
the requested operation, or safe to use in production.

## Qualification matrix

The following matrix is the minimum evidence set for the P0 exit gate. Each row
requires a captured device/backend evidence bundle with secrets and raw tokens
excluded or irreversibly redacted.

| Scenario | Local expectation | Backend verification / policy | Release decision |
| --- | --- | --- | --- |
| API 31+ device with explicit `SECURITY_LEVEL_STRONGBOX` | `STRONGBOX_REQUIRED` may produce accepted local evidence; `TEE_ALLOWED` may also accept it. | Validate the complete Android Key Attestation chain, Google/device trust root, CRL status, challenge, public-key/leaf consistency, package/signing identity, boot state, patch state, and required security level. Validate Play package/hash/timestamp/verdict policy. | Allow only after all checks and operation correlation pass. |
| API 31+ TEE-only device with `SECURITY_LEVEL_TRUSTED_ENVIRONMENT` | `STRONGBOX_REQUIRED` rejects with StrongBox-not-proven; `TEE_ALLOWED` may accept trusted-environment evidence. | Verify the chain and policy. A TEE result must not satisfy a StrongBox-required release policy. | Quarantine or reject StrongBox-required value operations; allow TEE policy only if explicitly approved. |
| API 26–30 with `isInsideSecureHardware = true` | Evidence is `TRUSTED_ENVIRONMENT` from the legacy source; it is never StrongBox. | Treat StrongBox as unproven. Validate any backend attestation evidence independently; do not infer StrongBox from the local boolean or a StrongBox request flag. | Reject StrongBox-required operations; separate TEE policy decision required. |
| API 26–30 with software/false legacy evidence | Local policy rejects software-backed evidence. | Backend must reject or quarantine regardless of a client-supplied claim. | Reject value operations. |
| API below supported StrongBox level or no StrongBox feature | `STRONGBOX_REQUIRED` fails closed before generation; no TEE downgrade. | Record only a coarse reason code; do not collect unnecessary device identifiers. | Reject StrongBox-required operations. |
| `TEE_ALLOWED` StrongBox generation failure | Explicit `TRUSTED_ENVIRONMENT_FALLBACK` with a reason code; no hidden best-effort result. | Verify the resulting key/evidence as TEE and apply the TEE policy, not the StrongBox policy. | Allow only if the operation explicitly permits TEE; otherwise quarantine. |
| `STRONGBOX_REQUIRED` generation or evidence failure | Generation failure or unavailable/unknown evidence is rejected. | No server override based only on the client error or token. | Reject value operations. |
| Invalid, incomplete, unknown-root, or revoked Android attestation chain | Local collection may still return bytes, but no release authorization follows. | Reject chain; validate trust anchor, signatures, extension placement/values, and official revocation status. | Reject and record a privacy-minimized reason. |
| Android challenge mismatch or public-key/leaf mismatch | Local binding is not sufficient to authorize. | Require the server-issued challenge to match the attested challenge and the leaf certificate to match the submitted public key. | Reject and quarantine the operation. |
| Play token package, signing certificate, or `requestHash` mismatch | The app only returns an opaque token. | Decrypt/verify server-side; require expected package name, signing certificate digest, exact canonical request hash, and the expected Cloud project/application identity. | Reject. Never let the client decide that a mismatch is safe. |
| Play token timestamp outside policy window | No local freshness decision is claimed. | Validate timestamp against an explicit bounded window and operation nonce/idempotency record. | Reject or quarantine; do not silently reuse. |
| Device/app/account verdict below release policy | No local verdict interpretation. | Define the minimum acceptable Play Integrity verdicts per operation and test every negative verdict. | Reject or quarantine according to the centralized policy; never default to allow. |
| Play services unavailable, API error, backend outage, or verifier outage | Client acquisition failure is surfaced; no local bypass is added. | Fail closed for value operations, expose only a non-sensitive outage reason, and follow the staged rollback/runbook decision. | No value-operation allow during an unapproved outage mode. |
| Existing AES `StrongBoxManager` seed/database key | StrongBox is requested where supported, but the existing path can fall back to TEE. | No KeyMint authorization conclusion may be derived from this path. | Do not claim universal StrongBox storage or protocol-key qualification. |
| Protocol signing key or signing manager | No P-256 signing integration exists in this slice. | Verify custody and policy per protocol; KeyMint evidence alone is insufficient. | Keep protocol signing outside this gate until separately evidenced. |

## Backend qualification checklist

### Android Key Attestation

- [ ] Generate a server-correlated challenge with bounded lifetime and an
  operation identifier; never use a reusable static challenge.
- [ ] Receive the certificate chain over an authenticated channel without
  logging raw certificates or private material in ordinary telemetry.
- [ ] Parse and verify every certificate signature and the expected trust
  anchor using an approved verifier.
- [ ] Check the official Android attestation certificate revocation status list
  with cache/update behavior suitable for production verification.
- [ ] Locate and validate the first trusted attestation extension, including
  challenge, application identity, key purpose/algorithm/profile, security
  level, verified-boot state, OS version, and patch levels required by the
  operation policy.
- [ ] Confirm the attested leaf public key equals the submitted public key and
  that the package name/signing certificate digest matches the release allowlist.
- [ ] Persist only the minimum evidence needed for an authorization decision and
  incident review; do not retain mnemonics, private keys, or unnecessary device
  identifiers.

### Google Play Integrity

- [ ] Send the opaque token to a trusted backend and perform decryption and
  verification through the configured Google Play Integrity server flow; never
  expose decryption credentials to the app.
- [ ] Require `requestDetails.requestPackageName` to match the expected package.
- [ ] Require `requestDetails.requestHash` to match the server's recomputation
  of the exact canonical authorization request.
- [ ] Validate `requestDetails.timestampMillis` against an explicit freshness
  window and the server-side operation record.
- [ ] Validate the expected app recognition and signing certificate digest,
  device integrity, licensing/account signals, and any optional environment
  verdicts used by the operation policy.
- [ ] Treat a token as an input to a server decision, not as a portable bearer
  authorization. Enforce operation binding and idempotency before approving a
  value operation.

### Durable replay, freshness, and enforcement

- [ ] Store a one-time operation record keyed by a server-generated operation
  identifier and nonce; atomically consume it on approval.
- [ ] Reject duplicate, expired, out-of-order, or cross-account/package
  submissions.
- [ ] Recompute the canonical request hash in one audited implementation and
  maintain cross-language test vectors for every field and normalization rule.
- [ ] Route every wallet value operation through the centralized gate tracked by
  [CON-1546](https://linear.app/conxian-labs/issue/CON-1546/p0-add-centralized-wallet-value-operation-gate-and-quarantine).
- [ ] Make missing, unverifiable, stale, quarantined, and outage states fail
  closed for value operations; permit only explicitly documented non-value
  behavior.

## Device and release acceptance checklist

- [ ] Capture at least one physical StrongBox-capable device with explicit
  StrongBox evidence and one physical TEE-only device.
- [ ] Cover API 26–30 legacy evidence, unsupported/no-StrongBox devices,
  Play-installed builds, and non-Play/sideloaded builds where the product will
  encounter them.
- [ ] Repeat the matrix across supported OS/security-patch ranges and record
  verified-boot and patch-state outcomes without retaining unnecessary device
  identity.
- [ ] Test StrongBox-required generation failure, TEE-allowed fallback, unknown
  evidence, invalid chain, revoked chain, challenge mismatch, package mismatch,
  signing-certificate mismatch, request-hash mismatch, stale timestamp,
  duplicate submission, and backend outage.
- [ ] Prove no private key, mnemonic, raw Play token, or full attestation chain
  is written to ordinary logs or exported through the TypeScript bridge.
- [ ] Add server-side negative tests and production-like integration tests;
  JVM/unit tests alone do not qualify hardware, Play installation state, or
  remote verification.
- [ ] Define privacy-minimized telemetry fields, retention, access controls,
  and deletion behavior before collecting rollout metrics.
- [ ] Document staged rollout cohorts, kill switch/rollback conditions,
  verifier/Play outage handling, operator ownership, and recovery steps.
- [ ] Obtain the independent security review and release acceptance tracked by
  [CON-1519](https://linear.app/conxian-labs/issue/CON-1519/p0-complete-independent-security-review-and-release-acceptance).
- [ ] Resolve the shared attestation roots, collateral, and revocation blocker
  in [CON-1543](https://linear.app/conxian-labs/issue/CON-1543/p0-operationalize-attestation-roots-collateral-revocation-and).
- [ ] Coordinate SDK-side expectations with
  [issue #240](https://github.com/Conxian/conxius-enclave-sdk/issues/240) and
  [issue #241](https://github.com/Conxian/conxius-enclave-sdk/issues/241).

## P0 exit gate

This work must remain **In Progress** until all of the following are evidenced
in a reviewed change or release artifact:

1. The qualification matrix passes on real devices, including StrongBox,
   TEE-only, legacy API, unsupported, and relevant Play installation states.
2. A trusted backend validates Android Key Attestation chain/root/revocation,
   challenge, key/profile, package/signing identity, security level, boot state,
   and patch state.
3. A trusted backend decrypts and verifies Play Integrity, compares package,
   signing certificate, canonical request hash, timestamp, and required verdicts.
4. Durable nonce/operation consumption and freshness policy prevent replay or
   cross-operation reuse.
5. The centralized value-operation gate enforces the verified decision and
   quarantines or rejects missing, stale, unverifiable, and outage states.
6. Privacy-minimized telemetry, staged rollout, rollback, and outage runbooks
   are reviewed and tested.
7. Independent evidence/review and release acceptance are recorded.

No item above is closed by client token acquisition, a local unit test, a
StrongBox feature flag, or the existence of an attestation certificate chain.

## Canonical sources

The following official sources were verified to resolve successfully on
2026-07-22. They are the source of truth for the server-side implementation;
this report does not reproduce their schemas or promise that external guidance
will remain unchanged.

- Android Key Attestation verification, trust roots, and revocation guidance:
  <https://developer.android.com/privacy-and-security/security-key-attestation>
- Official Android attestation certificate revocation status list:
  <https://android.googleapis.com/attestation/status>
- Google Play Integrity Standard request and server decryption flow:
  <https://developer.android.com/google/play/integrity/standard>
- Google Play Integrity verdict and request-details validation:
  <https://developer.android.com/google/play/integrity/verdicts>
- Google Play Integrity API overview and request-mode boundaries:
  <https://developer.android.com/google/play/integrity/overview>

## Related internal evidence

- [CON-1543 — attestation roots, collateral, and revocation](https://linear.app/conxian-labs/issue/CON-1543/p0-operationalize-attestation-roots-collateral-revocation-and)
- [CON-1512 — hardware-backed signing and mandatory attestation](https://linear.app/conxian-labs/issue/CON-1512/p0-enforce-hardware-backed-signing-and-mandatory-attestation-for-value)
- [CON-1546 — centralized value-operation gate](https://linear.app/conxian-labs/issue/CON-1546/p0-add-centralized-wallet-value-operation-gate-and-quarantine)
- [CON-1519 — independent security review and release acceptance](https://linear.app/conxian-labs/issue/CON-1519/p0-complete-independent-security-review-and-release-acceptance)
- [PR #441 — KeyMint authorization boundary](https://github.com/Conxian/conxius-wallet/pull/441)
- [PR #442 — Play Integrity SDK request boundary](https://github.com/Conxian/conxius-wallet/pull/442)
- [PR #443 — merged KeyMint hardening follow-up](https://github.com/Conxian/conxius-wallet/pull/443)
