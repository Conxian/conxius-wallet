# Silent-payment host microbenchmark (issue #355)

> **Host-only evidence:** This benchmark is not Android, JNI, Kotlin, wallet, device, or mobile
> performance evidence. Do not use these results as a mobile or release acceptance claim.

This benchmark compares the production `native/silent-payments` Rust
`scan_transaction` core with a benchmark-local TypeScript-only reference that
implements the same BIP-352 scan math using Node `crypto` SHA-256 and
`tiny-secp256k1`.

It is a **host core benchmark only**. It is not an Android, JNI, Kotlin, wallet,
or mobile-performance claim.

## Exact command

Run from the repository root:

```bash
pnpm bench:silent-payments -- --warmups 5 --samples 11 --iterations 250
```

The combined runner builds the Rust example in release mode, runs Rust and
TypeScript as separate processes, checks canonical match identities/checksums
before accepting timing results, and applies a default `2.0x` Rust speedup
threshold to the two main workloads. Override it with `--threshold <factor>` or
`SILENT_PAYMENTS_BENCH_THRESHOLD_X` when a different host screening threshold is
needed. The threshold is not a release or mobile acceptance criterion.

No raw result file is committed; the exact measured values are recorded below.

## Current measurements

The current committed-code run used the deterministic fixture, `5` warmups,
`11` timed samples, and `250` iterations per sample. Throughput is derived from
the median nanoseconds per scan. Speedup is `TypeScript median / Rust median`.

| Run | Workload | Rust median (ns/scan) | Rust throughput (scans/s) | TS median (ns/scan) | TS throughput (scans/s) | Rust speedup | 2.0x threshold |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | unlabeled no-match | 149,299.856 | 6,697.930104 | 1,017,374.004 | 982.922697 | 6.814300x | PASS |
| 1 | multi-match | 485,340.364 | 2,060.409713 | 3,531,903.944 | 283.133408 | 7.277169x | PASS |

The measured threshold passed for both workloads. The measured match counts were
`0` per scan for unlabeled no-match and `8` per scan for multi-match (`22,000`
matches across the `2,750` timed scans in the multi-match run).

### Host and tool metadata

The runner recorded the following metadata for the current measurement:

| Field | Value |
| --- | --- |
| Host | Linux `aarch64` / `linux-arm64` devbox |
| CPU identification | unavailable from this host (`unknown` in runner output) |
| Node.js | `v22.23.1` |
| Rust | `rustc 1.89.0 (29483883e 2025-08-04)` |
| Cargo | `cargo 1.89.0 (c24e10642 2025-06-23)` |
| TypeScript ECC backend | `tiny-secp256k1 2.2.4` WASM |
| Generated at (UTC) | `2026-07-20T19:05:47.904Z` |
| Rust code commit during measurement | `3b97c2875f2be38d3d3ee86f327898cdd3a59a39` |

The benchmark was run after the implementation commit above; the documentation
update is a follow-up commit and is not part of the measured code.

## Fixture and correctness scope

`benchmarks/silent-payments/fixture.json` is shared by both runners and contains
only deterministic synthetic public transaction records plus a synthetic scan
scalar. It is not derived from a wallet seed and must not be replaced with a
real wallet secret.

- `unlabeled-no-match`: two eligible compressed input keys and two valid
  Taproot output keys, with no receiver match.
- `multi-match`: three eligible compressed input keys, one decoy output, and
  eight unlabeled outputs matching sequential `k = 0..7` identities in reverse
  output order. This gives the bounded `k`/output search enough work to measure
  without claiming a typical transaction shape.
- Labels are empty in the measured workloads. The reference keeps the Rust
  label/negation branches available for future fixture coverage, but no label
  performance result is claimed here.

Before timing, each runner asserts the fixture's expected output index, x-only
output key, `k`, match kind, label metadata, negation flag, output metadata, and
stop reason. The combined runner then verifies canonical result equality,
checksum equality, and scan/match counts between the two processes.

The checksum is a timing-loop sink as well as a cross-runner invariant, so the
scan result cannot be optimized away without changing the reported checksum.
JSON parsing and high-level record construction happen outside timed loops. The
timed Rust scan includes full structural validation of the input/output records,
including duplicate and record-shape checks. The TypeScript reference mirrors
cryptographic point validation and conversion inside each scan to mirror the
Rust API boundary, but it does not repeat every Rust duplicate/record-shape
check. The observed Rust speedup is therefore conservative; this is not a
perfectly identical validation-cost comparison.

## Interpretation and limitations

The current result supports the narrow statement that, on this host and
fixture, the Rust production scan core was approximately `6.8143x` faster for
the unlabeled no-match workload and `7.2772x` faster for the multi-match
workload than the benchmark-local TypeScript reference.

It does **not** establish any of the following:

- Android or mobile performance, battery behavior, thermal throttling, or
  device-specific throughput.
- JNI, Kotlin, SPB binary encoding/decoding, JSON parsing, Room persistence,
  network/Esplora ingestion, block-filter discovery, or transaction parsing
  performance. Those paths are excluded from the timed loops.
- End-to-end wallet scan latency or production UX improvement.
- Equivalence of the Rust `secp256k1` backend and the TypeScript
  `tiny-secp256k1` WASM backend beyond the canonical fixture results.
- Performance for labels, large receiver groups, pathological input/output
  counts, real chain distributions, or a full `K_MAX` search.

The TypeScript implementation exists only inside `benchmarks/silent-payments/`
as a comparison reference. It is not wired into the production service and is
not a fallback scanner. An Android device benchmark remains required before
claiming a material mobile improvement.
