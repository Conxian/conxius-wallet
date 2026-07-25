# Issue #444: Wallet value-operation gate containment

**Date:** 2026-07-25

**Issue:** [GitHub #444](https://github.com/Conxian/conxius-wallet/issues/444)

**Code evidence reviewed:** `bf16fea0cb551bdc5c1147d19af6d42fdd32a97a`
on `charlie/issue-444-value-operation-gate`

**Status:** **Implemented — fail-closed containment; production execution
unsupported.**

## Scope and architecture

Issue #444 introduces a wallet-local containment boundary for value-bearing
sign, broadcast, payment, bridge, swap, settlement, and protocol-adapter paths.
The design is deterministic and provider-neutral:

1. App/context callers enqueue a typed authorization request and display the
   exact deterministic intent for user confirmation.
2. One application gate validates the request, protocol-key custody shape, and
   provider evidence result.
3. A successful authorization, if a future authoritative verifier returns one,
   is bound to one canonical envelope digest and an unforgeable process-local
   capability.
4. Execution callers supply an exact `{ authorization, artifact }` request and
   handle a discriminated outcome.
5. The native PSBT signer consumes the exact `sign` stage immediately before
   its module-private native call. Broadcast and settlement require their own
   authoritative boundaries and receipts.

Primary implementation surfaces:

- `services/value-operation-gate.ts`
- `services/value-operation-evidence-verifier.ts`
- `services/value-operations.ts`
- `services/value-operation-result.ts`
- `services/value-operation-authorization-queue.ts`
- `services/value-signer.ts`
- `services/bitcoin-broadcast.ts`

App/context/UI integration is in `App.tsx`, `context.tsx`,
`components/ValueOperationAuthorizationModal.tsx`, `components/Dashboard.tsx`,
`components/PaymentPortal.tsx`, and `components/NTTBridge.tsx`.

## Threat boundary

The contained threats are caller-fabricated authorization objects, malformed
or swapped artifacts, synthetic provider evidence, direct signer/broadcaster
bypasses, replay of a process-local stage, and adapters that previously returned
plausible txids, preimages, booleans, or completion state without an
authoritative provider result.

This implementation is not an authoritative trust service. The capability
registry and `sign`/`broadcast`/`settle` stage consumption are local to one
client process. They are defense in depth against in-process reuse, not durable
or distributed replay prevention. The local expiry is not trusted evidence
freshness or trusted time.

## Canonical schema and digest contract

The implemented schema and domain names are:

| Purpose | Name |
| --- | --- |
| Payload schema | `conxius.wallet.value-operation-payload.v1` |
| Intent schema | `conxius.wallet.value-operation-intent.v1` |
| Envelope schema | `conxius.wallet.value-operation-envelope.v1` |
| Payload hash domain | `conxius.wallet.value-operation-payload.sha256.v1` |
| Intent hash domain | `conxius.wallet.value-operation-intent.sha256.v1` |
| Envelope hash domain | `conxius.wallet.value-operation-envelope.sha256.v1` |
| Bound artifact kind | `conxius.wallet.bound-value-artifact.v1` |
| Authorization capability kind | `value-operation-authorization` |

The envelope has `envelopeVersion: 1` and binds all of these fields:

- `schema` and `envelopeVersion`
- `operationType`
- `chain` and `layer`
- `canonicalOperationDigest`
- `network`
- `purpose` and `domain`
- `nonce` and `challenge`
- `audience`
- `protocolKeyIdentity`
- `algorithm`
- `providerStatus` and `evidenceStatus`
- `providerDigest` and `evidenceDigest`

Canonical encoding accepts only a bounded JSON-compatible data model. It sorts
object keys by code unit, requires NFC-normalized strings, rejects sparse
arrays, accessors, symbols, cycles, non-finite values, negative zero, unsafe
integers, and non-plain objects, and requires precision-sensitive monetary
values to use application-defined canonical strings. SHA-256 inputs are domain
separated with a NUL byte between the versioned domain and canonical encoding.
Stable byte-level encoding and digest vectors are asserted in
`tests/value-operation-gate.test.ts`; this report intentionally does not copy
operation payloads or other potentially sensitive evidence.

## Distinct authorization boundaries

The implementation deliberately separates:

- **User confirmation:** Records that the displayed intent was confirmed and
  binds its intent digest. It is never provider evidence or custody proof.
- **Provider evidence:** Opaque caller input that has no trusted status flags.
  Only a reviewed verifier may classify and bind it authoritatively.
- **Protocol-key custody:** Identifies the expected native enclave boundary,
  protocol-key identity, and algorithm. Native selection is not evidence that
  the key or device is qualified.
- **Provider receipt:** A post-execution artifact binding envelope digest,
  artifact digest, and provider receipt digest. It is required for submitted or
  settled outcomes and is not supplied by confirmation or local execution.

Debug status, simulation, synthetic objects, local availability, native
selection, and UI confirmation can never be treated as provider evidence.

## Outcome and reason semantics

Gate outcomes are discriminated as `authorized`, `rejected`, `unsupported`,
`simulated`, or `quarantined`. Examples include:

- Rejected: user cancellation; malformed operation/custody/evidence; stale or
  mismatched evidence; envelope mismatch; expired, forged, mismatched, or
  consumed authorization.
- Unsupported: `unsupported_provider` or
  `unsupported_protocol_key_custody`.
- Simulated: simulated, debug, or synthetic provider evidence. These outcomes
  are non-authoritative and never authorize execution.
- Quarantined: replayed, unavailable, or revoked provider evidence.

Adapter execution outcomes are `rejected`, `unsupported`, `simulated`,
`quarantined`, `indeterminate`, `submitted`, or `settled`. Reviewed unsupported
adapters validate exact authorization and artifact binding, then return
`unsupported` with `qualified_adapter_unavailable`. `submitted` and `settled`
types require provider receipt bindings; a bare string txid, preimage, boolean,
or local completion state cannot satisfy those contracts.

## Exact production behavior

`services/value-operation-evidence-verifier.ts` is the concrete production
adapter. It always returns:

```text
{ kind: 'unsupported', reason: 'unsupported_provider' }
```

Therefore no production value operation is authorized by this change. The
reviewed sign, broadcast, payment, bridge, swap, settlement, merchant, and
protocol adapter paths return typed rejected, unsupported, or quarantined
outcomes before irreversible side effects. `services/bitcoin-broadcast.ts`
checks the exact transaction artifact but performs no network submission because
there is no qualified provider receipt. The native-only PSBT signer has no
browser/software fallback and is not reachable with a production authorization
while the verifier remains unsupported.

## Migration inventory

### Application, context, and UI

- `App.tsx`, `context.tsx`, and
  `components/ValueOperationAuthorizationModal.tsx`: one typed authorization
  queue and display/confirmation flow.
- `components/Dashboard.tsx`, `components/PaymentPortal.tsx`, and
  `components/NTTBridge.tsx`: deterministic intents, fail-closed handling, no
  synthetic signed/broadcast/paid/completed state.
- `components/Marketplace.tsx`: preview-only behavior; no Breez payment,
  delayed success, delivery code, payment verification, or Bitcoin-live claim.
- `components/Studio.tsx` and `components/DeFiDashboard.tsx`: caller adaptation
  to contained outcomes/non-value behavior.

### Protocol adapters and adjacent value paths

- Ark: `services/ark.ts`
- RGB: `services/rgb.ts`
- StateChain: `services/statechain.ts`
- Maven: `services/maven.ts`
- Taproot Assets: `services/taproot-assets.ts`
- Monetization: `services/monetization.ts`
- Wormhole/NTT: `services/wormhole-signer.ts`, `services/ntt.ts`
- Lightning/backends: `services/lightning.ts`,
  `services/lightning-backend.ts`, `services/breez.ts`
- Swaps: `services/swap.ts`, `services/boltz.ts`
- DLC: `services/dlc.ts`
- PayJoin/CoinJoin: `services/payjoin.ts`, `services/coinjoin.ts`
- Protocol broadcast/verification and merchant fallbacks:
  `services/protocol.ts`, `services/real-world.ts`, `services/yield.ts`
- Seed-based PSBT and signer bypasses: `services/psbt.ts`,
  `services/signer.ts`, `services/enclave-storage.ts`,
  `services/value-signer.ts`, `services/bitcoin-broadcast.ts`
- Adjacent identity/biometric/multisig/Web5 cleanup: `services/identity.ts`,
  `services/biometric.ts`, `services/multisig.ts`, `services/web5.ts`
- Android raw BDK signing bypass:
  `android/core-bitcoin/src/main/kotlin/com/conxius/wallet/bitcoin/BdkManager.kt`

No reviewed in-repository production caller remains on the old bare execution
paths. The API change is intentionally source-breaking: callers must provide
the exact authorization and canonical artifact and must handle discriminated
outcomes instead of expecting string txids/preimages or boolean success.

## Negative regression inventory

The issue #444 tests assert that reviewed production sources and runtime paths
do not:

- fabricate Ark redemption/forfeit, StateChain withdrawal, Maven, Taproot,
  Boltz, gas-swap, LNURL, or other synthetic txids;
- fabricate Lightning preimages or call Breez/native payment methods directly;
- report `SETTLED`, payment sent, transfer broadcast, purchase success, code
  delivery, or verified completion without a qualified receipt;
- use timestamps, random values, timers, local storage, notifications, or hard-
  coded fallback addresses to manufacture terminal value-operation state;
- export raw enclave batch signing, raw Breez payment, seed/mnemonic PSBT
  signing, or `BdkManager.signPsbt` bypasses;
- accept forged capabilities, swapped artifacts, changed amounts/routes,
  malformed envelopes, wrong digests, repeated stages, debug/simulated/
  synthetic evidence, or caller-fabricated verified results;
- invoke signers, broadcasters, payment adapters, or settlement functions after
  unsupported/rejected authorization;
- restore legacy bare NTT txids as completed work;
- allow Marketplace preview interactions to become payment or delivery claims.

Key regression files include `tests/value-operation-gate.test.ts`,
`tests/value-operation-authorization-queue.test.ts`,
`tests/value-operation-result.test.ts`,
`tests/value-operation-ui-boundaries.test.tsx`,
`tests/value-signer-artifact-binding.test.ts`,
`tests/value-operation-adapter-source.test.ts`, and the focused adapter tests.

## Validation evidence

The code candidate's latest reported validation is:

| Check | Command | Status |
| --- | --- | --- |
| Focused value-operation and migrated-adapter tests | Exact command below | Passed: 24 files, 167 tests. |
| Full Vitest | `pnpm test --run` | Passed: 91 files, 515 passed, 1 skipped. The count is evidence for this branch run, not a permanent repository invariant. |
| TypeScript 6/7 | `pnpm run typecheck` | Passed. |
| Compatibility boundary | `pnpm run check:typescript-compat` and `pnpm run check:typescript-toolchain` | Passed. |
| Lint | `pnpm run lint` | Passed with 0 errors and 476 existing warnings. |
| Runtime contamination | `bash scripts/ci/check_runtime_contamination.sh` and `bash scripts/ci/test_check_runtime_contamination.sh` | Passed. |
| Documentation version drift | `python3 scripts/check_docs_sync.py` | Passed. |
| Diff hygiene | `git diff --check` | Passed. |
| Web production build | `pnpm run build` | TypeScript completed and Vite reached chunk rendering, then the process was killed in the constrained 3.8 GiB environment. Completion remains pending final/CI validation; this is an environment block, not an implementation failure. |
| Android app unit tests | `cd android && ./gradlew --no-daemon :app:testDebugUnitTest` | Blocked before execution because the local environment has no Android SDK and no `ANDROID_HOME`/`ANDROID_SDK_ROOT`. Pending CI; this is not recorded as a pass or implementation failure. |
| Android release lint | `cd android && ./gradlew --no-daemon :app:lintRelease` | Blocked by the same missing-SDK environment. Pending CI; not recorded as a pass or implementation failure. |

Focused test command executed for this documentation checkpoint:

```bash
pnpm exec vitest run \
  tests/value-operation-gate.test.ts \
  tests/value-operation-authorization-queue.test.ts \
  tests/value-operation-result.test.ts \
  tests/value-operation-ui-boundaries.test.tsx \
  tests/value-signer-artifact-binding.test.ts \
  tests/value-operation-adapter-source.test.ts \
  tests/bitcoin-broadcast.test.ts \
  tests/marketplace-boundary.test.tsx \
  tests/lightning-resilience.test.ts \
  tests/ntt.test.ts tests/swap-execution.test.ts tests/dlc.test.ts \
  tests/payjoin.test.ts tests/coinjoin.test.ts tests/ark.test.ts \
  tests/rgb.test.ts tests/statechain.test.ts tests/maven.test.ts \
  tests/taproot-assets.test.ts tests/monetization.test.ts \
  tests/wormhole-signer.test.ts tests/protocol.test.ts \
  tests/real-world.test.ts tests/yield.test.ts
```

Required final CI before promotion:

- successful web production build;
- Playwright E2E;
- Android app unit tests;
- Android release lint;
- relevant Android module compilation and tests.

## Unsupported and non-goal matrix

| Area | Current state |
| --- | --- |
| Production value execution | Unsupported; production verifier always returns `unsupported_provider`. |
| Provider qualification | Not established for wallet, cloud, Nitro, KMS, HSM, WebAuthn, TPM, or any other provider. |
| Hardware qualification | No StrongBox, KeyMint, Play Integrity, secure-element, or device matrix qualification is established. |
| External verifier | Not implemented or integrated. |
| Roots/collateral/revocation | Not operationalized; CON-1543 remains separate. |
| Trusted time/freshness | Not established. Local expiry is defense in depth only. |
| Replay prevention | Stage tracking is client-process-local, not durable or distributed replay protection. |
| Provider receipts/finality | Not implemented or qualified; no submitted/settled production claim is supported. |
| SDK canonical rail/trust/replay | Not reimplemented in the wallet; remains a dependency boundary. |
| CON-1512 / CON-1517 | Not closed by this wallet containment change. |
| Production support and rollout | No support claim, staged rollout, outage mode, rollback acceptance, or release acceptance is established. |
| Security review | Independent review remains required. |

## Promotion gate

Issue #444 is High/P0 security containment. Promotion to `main` requires COO
review under the operating model. That review may accept the containment change;
it must not relabel unsupported execution as provider-qualified, hardware-
qualified, production-supported, or release-accepted.
