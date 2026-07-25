# CON-1546: Wallet value-operation gate and quarantine boundary

**Status:** Wallet-owned fail-closed boundary implemented; authoritative
provider verification, durable distributed replay, protocol qualification, and
production release acceptance remain external/open.

**Implemented:** 2026-07-25 against `origin/main` commit
`72f4b5e9a0809ad48fea08398297f0bc42dd8954`.

**Canonical trackers:**
[CON-1546](https://linear.app/conxian-labs/issue/CON-1546/p0-add-centralized-wallet-value-operation-gate-and-quarantine)
and [GitHub #444](https://github.com/Conxian/conxius-wallet/issues/444).

## Enforced wallet boundary

`services/value-operation.ts` owns the feature-facing TypeScript
value-operation contract. It exposes request builders, data types, and opaque
capability consumers, but no production confirmer or constructible gate.
Production confirmation lives in
`services/app-private/value-operation-authority.ts`; `App.tsx` is its only
allowed production importer. A repository architecture test enumerates
production TypeScript modules and fails if a component, service, or core module
imports that authority. Capability registration, issuance, and replay state now
live only inside the authority factory closure. The type-only
`services/value-operation-capability-consumer.ts` module has no runtime exports;
feature code receives only the authority-owned consume/validate closure through
the App-owned authorizer callback. A consumer from a separately instantiated
authority rejects capabilities issued by another authority. The resolver-aware
graph includes static imports/re-exports, import-equals, string-literal dynamic
`import()`, CommonJS `require()`, and import-then-runtime-re-export wrappers;
non-literal production loaders fail closed. Tests may import private modules to
exercise the boundary.

Its versioned, provider-neutral envelope binds the operation type, chain/layer,
canonical payload digest, network, purpose, nonce, audience, key identity,
algorithm, provider/evidence status, evidence digests, and bounded validity
window. Canonicalization sorts object keys, preserves array order, accepts only
plain JSON values, rejects unsupported/non-finite values, and hashes with
SHA-256. The exact signable payload, signing type, layer, and confirmation text
are immutable and rebound immediately before native signing.

The gate returns discriminated `allowed`, `rejected`, `quarantined`,
`simulated`, or `unsupported` outcomes. Only `allowed` carries a wallet-gate
registered authorization. The evaluator rejects or quarantines:

- user rejection and envelope mutation;
- missing, stale, malformed, revoked, mismatched, unsupported, or
  non-authoritative evidence;
- request-digest, nonce, audience, key-identity, or algorithm mismatches;
- malformed/expired validity windows; and
- locally detected replay of a consumed audience/nonce pair.

Production value signing additionally requires `Capacitor.isNativePlatform()`.
The complete signing/finalization entrypoint now lives in
`services/app-private/value-operation-signer.ts`, whose only production
importer is the App-private authority. Its raw native plugin adapter and PSBT
assembly modules are separately import-restricted to that private signer.
`services/signer.ts` retains derivation/parsing and signing result types only;
`services/enclave-storage.ts` no longer registers or accesses the raw plugin and
exports no raw handle or generic single/batch signing wrappers. Raw
`SecureEnclave` registration is restricted to
`services/app-private/native-value-signing.ts` and
`services/app-private/secure-enclave-non-signing.ts`; the latter exposes only
narrow storage, biometric, wallet-info, and derivation functions. Repository
AST policy rejects raw plugin registration aliases, dynamic/destructured
registration, `Capacitor.Plugins.SecureEnclave`, element access,
`signTransaction`/`signBatch` calls or extraction, and public re-exports outside
that minimum allowlist. Native rejection, absence, empty output, or
error returns a non-allowed outcome and cannot select a TypeScript worker
fallback. Legacy identity and Web5 generic signing routes are quarantined
rather than retaining alternate raw-native bypasses.

Capability issuance also requires the closure-registered authorization from the
exact allowed outcome and rechecks its immutable envelope against the exact
request before issuing broadcast or settlement authority. No independently
importable module exports registration, issuer construction, or broadcast or
settlement minting functions.

## Quarantined callers

The React authorization queue now owns the App-private authority instance,
accepts a typed `ValueOperationRequest`, and invokes the gate's confirm or
reject path after the application modal resolves. Feature services receive an
authorizer callback rather than a vault plus caller-supplied confirmation
boolean. A plain object or raw `true` value cannot become a registered
authorization, and fabricated `allowed` results are rejected before their
signature or settlement capability can be consumed. A genuine outcome returned
for a different request is also rejected through exact envelope/request and
authority-closure binding.

For PSBT operations, successful native signing additionally creates an opaque
authority-issued broadcast authorization bound to the exact signed hex,
chain/layer, network, and a validity window no longer than 60 seconds. The
wallet broadcaster validates this capability before network I/O, consumes it
once even if submission fails, and rejects fabricated, mismatched, stale, or
replayed capabilities. Dashboard send, Payment Portal, and native-peg bridge
carry the capability from signing to this hardened submission boundary; the
former raw public broadcast function is no longer exported.

Lightning settlement uses a separate opaque, authority-issued authorization.
It is bound to the exact canonical payment intent, Lightning layer, provider
context, network, and a validity window no longer than 60 seconds. Invoice,
LNURL, and Breez on-chain intents include their exact invoice/callback/request
and amount fields where applicable. The authorization is consumed before any
native plugin or LND HTTP request, and fabricated, wrong-intent, wrong-amount,
wrong-invoice, wrong-provider/network, stale, replayed, denied, quarantined, or
wrong-request callback outcomes fail before settlement I/O. Payment Portal now
carries this capability from its queue outcome into the final native Breez
submission instead of discarding the queue result. Direct native Breez, Breez
plugin, and direct LND BOLT11 methods require the exact encoded amount and
capability. Canonical BOLT11 decoding and validation is centralized and runs
before capability consumption and before plugin/HTTP I/O at every enabled
entrypoint. LND LNURL-pay and LNURL-withdraw are explicitly quarantined before
capability consumption or HTTP I/O because their current contracts cannot bind
the provider-returned/withdrawal invoice and exact positive whole-satoshi
amount. Legacy Breez backend settlement and LNURL methods remain quarantined.

PayJoin is quarantined before receiver fetch, signer callback, PSBT finalization,
or transaction material. Boltz reverse and submarine swap initiation are
quarantined before randomness, software claim/refund key generation, or provider
I/O; the software `ECPair`/WIF path was removed. Boltz fee output is explicitly
typed as a non-authoritative estimate.

Dashboard send, Payment Portal on-chain/Lightning send, native-peg bridge, and
Wormhole signing use this boundary. Current callers intentionally construct
**unverified** requests. The wallet-owned adapter hook is intentionally unwired
and cannot be injected by feature callers; therefore current paths cannot
display or broadcast a production success.

Ark, RGB, StateChain, Maven, Taproot Assets, and B2B invoice value-signing paths
also enter the shared gate. Their previous success-shaped fallbacks were
removed:

- no mock PSBT/hex or random Dashboard transaction ID;
- no timeout/random NTT completion;
- no Ark, StateChain, Maven, or signature-derived Taproot Asset transaction ID;
- no RGB `pending_on_chain_txid`; and
- no unsupported-platform Lightning preimage or LNURL pseudo-transaction ID;
- no Boltz or gas-swap timestamp-derived transaction ID;
- no Wormhole raw-signature fallback when a complete signed transaction is
  absent.

The closure audit also quarantined exact analogues that remained outside the
gate: public-callback NTT execution, Changelly swap initiation, Yield provider
transaction construction, CoinsPaid merchant invoice/payment-address creation,
and Babylon stake/unbonding transaction construction. Each now throws before
signer access, provider I/O, or a success-shaped result. Quote/status/fee reads
remain non-authoritative discovery functions.

Nostr event signing and Web5/identity public derivation are classified
separately as non-value identity/message paths. They do not return transaction,
broadcast, settlement, payment, or swap success. Their derived-key exposure is
not claimed as closed by CON-1546 and remains subject to the zero-leak/runtime
work tracked outside this value-operation boundary.

After signing is eventually authorized, services still require a non-empty
authoritative provider/broadcast receipt before emitting success. Taproot
Assets and RGB remain unsupported after authorization until authoritative
broadcast/anchor adapters exist.

## External adapter seam

The wallet accepts authoritative evidence decisions only through a
`ValueOperationEvidenceAdapter`. The wallet-owned adapter hook is currently
`null`; the application gate does not accept a caller-provided adapter.
UI/service request objects cannot carry or
self-assert `verified`/`authoritative` state. The adapter receives an immutable
request-binding digest and returns only public, non-secret binding data and
adapter-reported evidence digests. Those digests are recorded in the envelope;
this change does not define an expected digest set or independently validate
their semantic contents. The wallet does not decode Play Integrity tokens, verify
Android attestation chains, or invent provider verdicts. The external verifier
must bind its decision to the exact request digest, nonce, audience, key
identity, algorithm, and validity window.

No private key, mnemonic, seed, raw provider token, certificate chain, or
transaction secret belongs in the envelope or ordinary logs.

## Explicit non-claims and remaining work

This change does **not** claim:

- StrongBox, KeyMint, Play Integrity, device, provider, protocol-key, or release
  qualification;
- backend token/attestation verification or trust-root/revocation handling;
- durable replay protection across processes/devices (the delivered signing,
  broadcast-capability, and settlement-capability stores are local and
  process-scoped);
- authoritative Ark/RGB/StateChain/Maven/Taproot Assets/Wormhole provider
  behavior; or
- successful production broadcast or settlement without a real provider
  receipt.

Production enablement still requires a reviewed wallet-owned integration of the
authenticated verifier adapter, the backend verification and real-device
matrix in the
[CON-1544 boundary report](CON_1544_KEYMINT_AUTHORIZATION_BOUNDARY.md), a durable
one-time operation store, protocol-specific signer/broadcast qualification,
staged rollout/rollback controls, and COO review for this P0 change.

## Regression evidence

Focused tests cover deterministic canonicalization, mutation binding, stale and
non-authoritative evidence, request/evidence mismatch, App-private import
enforcement (including dynamic import, CommonJS require, runtime wrappers, and
non-literal loaders), raw SecureEnclave AST policy fixtures, native-only
execution, fabricated/cross-authority/wrong-request authorization rejection,
exact-hex broadcast binding, and exact-intent Lightning/Breez/LND
provider/network/expiry/single-use checks. Mock signer, randomness, native
plugin, and HTTP calls verify zero I/O for PayJoin, LND LNURL-withdraw, Boltz,
NTT, Changelly, Yield, merchant invoice, and Babylon quarantines. Protocol
callers cannot sign, broadcast, settle, construct a value transaction, or return
synthetic success when the central queue rejects or evidence is unqualified.

Final follow-up verification on July 25, 2026:

- focused architecture/authority/broadcast/Lightning/PayJoin/Boltz suite:
  5 files, 48 tests passed;
- `pnpm exec vitest run`: 81 files, 448 passed, 1 skipped;
- `pnpm run typecheck`: TypeScript 6 and 7 toolchains passed;
- `pnpm run lint`: 0 errors, 575 baseline warnings;
- `pnpm run build`: passed;
- `pnpm run check:android-security`: passed;
- `pnpm exec node scripts/ci/audit_with_exceptions.mjs --evidence <fresh-path>`:
  default policy passed with the existing pending-approval `bigint-buffer` and
  `elliptic` warnings; and
- `git diff --check` plus production boundary/synthetic-success scans: passed.
