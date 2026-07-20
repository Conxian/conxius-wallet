# BIP-110 Client-Side Alignment

**Status (July 20, 2026): client-side alignment only; not consensus compliance.**

Conxius Wallet uses BIP-110 principles to make Bitcoin fee recommendations less
sensitive to inscription-heavy transactions. This document describes wallet
policy and measurement behavior. It does **not** claim that BIP-110 is active on
any network, enforce consensus rules, or make the wallet a BIP-110 validator.

## Clean-block fee model

The default `services/fees.ts:getRecommendedFees()` path first attempts the
Bitcoin-specific clean-block oracle in `services/bitcoin-fee-oracle.ts`:

1. Read up to **6 confirmed block summaries** from the configured Bitcoin API.
2. Sample at most **3 transaction pages per block**, with at most **64
   transactions per block** and **256 transaction records overall**.
3. Require a usable fee and virtual-size measurement: an explicit bounded
   `vsize`, or a bounded `weight` converted with `ceil(weight / 4)`, plus valid
   bounded non-coinbase `vin`/`vout` structure. Raw serialized `size` is not a
   virtual-size measurement and is rejected when no `vsize` or `weight` is
   present.
4. Exclude transactions containing a narrowly recognized inscription envelope
   in input `witness` or `scriptsig` data.

The provider and JSON transport are injectable and receive an `AbortSignal`.
Production uses the existing `fetchWithRetry` network helper, which preserves
caller cancellation and stops retries when the signal is aborted. Tests use
deterministic in-memory providers and never require network access. The general
on-chain payment path in `components/PaymentPortal.tsx` uses the resulting
`fastestFee`; protocol-specific builders with their own fee policies are
intentionally outside this issue.

## Inscription detection semantics

The classifier does **not** treat every Taproot transaction as inscription data.
It only recognizes raw input script data that is bounded, valid hexadecimal, and
starts with the conventional envelope shape:

```text
OP_FALSE OP_IF PUSH("ord") ... OP_0 ... OP_ENDIF
```

Script and witness items are capped at **4,096 bytes**, with at most **32 witness
items per input**, **128 inputs**, and **128 outputs** inspected. Malformed,
oversized, unconfirmed, or otherwise unusable records are skipped from the fee
sample. The parser does not retain or log raw transaction payloads.

This is intentionally a conservative client-side heuristic. It is not a full
Bitcoin Script interpreter and does not classify arbitrary data commitments as
inscriptions.

## Accuracy model and fallback behavior

At least **12 clean samples** are required by default. Clean sampling has a
default **5-second aggregate deadline** across block and transaction-page
requests, rather than a separate multi-second retry budget for every request.
If clean sampling times out, is canceled, or cannot produce enough samples,
`getRecommendedFees()` attempts `/v1/fees/recommended` under a separate default
**5-second fallback deadline**. Therefore the normal fee lookup returns a clean
recommendation, a legacy recommendation, or the fixed fallback within at most
about **10 seconds** (and sooner when the caller supplies an earlier abort
signal). The estimate is
deterministic and uses nearest-rank percentiles, rounded up to whole sat/vB:

| Recommendation | Clean-sample percentile |
| --- | ---: |
| `fastestFee` | 90th |
| `halfHourFee` | 60th |
| `hourFee` | 35th |

These labels are fee-market targets, not delivery guarantees. If the minimum
sample count is not met, a block or transaction request fails, or the data is
malformed, the API falls back to `/v1/fees/recommended` within the bound above.
If that endpoint also fails, times out, or returns an invalid shape, the
existing fixed fallback remains `15 / 8 / 5` sat/vB. Callers that need the
legacy endpoint-only behavior can pass `{ useCleanBlocks: false }`; the same
legacy deadline and caller-supplied cancellation still apply.

## Privacy and security properties

- Only public confirmed-block metadata and public transaction fee/script fields
  are inspected.
- No wallet keys, mnemonics, addresses, or signing material enter the oracle.
- Sample counts, script sizes, page counts, and parsing work are bounded before
  classification.
- Fee rates use only `vsize` or `ceil(weight / 4)`; serialized `size` alone is
  rejected to avoid overstating or understating sat/vB.
- Network and parser failures fail closed to the existing fee fallback without
  exposing raw response details.
- The oracle does not change transaction construction, signing, or broadcast
  policy.

## Silent Payments (BIP-352) boundary

The fee tests include a Silent Payment-style transaction with ordinary Taproot
output data and confirm that it is not excluded solely because it uses Taproot.
The existing BIP-352 implementation remains a **partial receiver-scanning
slice**: it is not a claim of release readiness, full sending support, native
address encoding, spending/tweak recovery, authoritative spentness, compact
filter discovery, or raw/Merkle proof verification. This issue does not alter
the BIP-352 key, native, or persistence boundaries.

## Governance

Issue #381 is HIGH priority. This change requires COO review under `AGENTS.md`
before promotion to `main`; opening this pull request does not authorize merge
or release promotion.

See also:

- [Implementation Registry](../protocols/IMPLEMENTATION_REGISTRY.md)
- [Silent Payments (BIP-352)](../protocols/silent-payments.md)
- [Upstream Conxian BIP-110 alignment](https://github.com/Conxian/lib-conxian-core/blob/main/docs/BIP110_ALIGNMENT.md)
