# Native BIP-352 receiver scan core

This crate is the Phase 1, deterministic Rust core for Conxius Wallet silent-payment receiver
scanning. It accepts already-parsed transaction records and separate scan-secret bytes; it does
not perform network or filesystem I/O, parse JSON, call JNI, or access Android Keystore material.

The public `scan_transaction` API is intended to be wrapped by one JNI batch call in Phase 2. It
keeps public transaction records separate from the private scan secret and returns only output
match metadata. Private scan keys, shared secrets, intermediate points, and private output tweaks
are not returned or included in debug/error output.

## Scan limits and input invariants

Each `scan_transaction` call applies these hard limits before allocating parsed records or
entering secp256k1 loops:

| Resource | Limit |
| --- | ---: |
| Transaction input outpoints | `MAX_TRANSACTION_INPUTS = 4096` |
| Eligible input public keys | `MAX_ELIGIBLE_INPUTS = 4096` |
| Taproot outputs | `MAX_TAPROOT_OUTPUTS = 4096` |
| Receiver labels | `MAX_LABELS = 256` |
| Sequential output indices per receiver group | `K_MAX = 2323` |

Exceeding any caller-controlled collection limit returns `ScanError::ResourceLimitExceeded` with
the resource, actual count, and configured limit. The transaction record must also be canonical:
every eligible input outpoint must occur exactly once in `all_input_outpoints`, the full input list
must contain no duplicate outpoints, and the eligible input list must contain no duplicate
outpoints. These checks preserve the serialized `OutPoint` representation used for BIP-352
ordering and hashing; malformed records are rejected before public-key parsing or ECC work.

## Local verification

```bash
cargo test --manifest-path native/silent-payments/Cargo.toml --all-targets
```

## Specification and vector sources

The implementation follows the canonical BIP-352 specification and its reference test vectors:

- Specification: <https://github.com/bitcoin/bips/blob/8c369ac8e60629ac6c032ffe21bb5ec5b35213d7/bip-0352.mediawiki>
- Official vectors: <https://github.com/bitcoin/bips/blob/8c369ac8e60629ac6c032ffe21bb5ec5b35213d7/bip-0352/send_and_receive_test_vectors.json>
- Reference implementation: <https://github.com/bitcoin/bips/blob/8c369ac8e60629ac6c032ffe21bb5ec5b35213d7/bip-0352/reference.py>

`tests/data/send_and_receive_test_vectors.json` is vendored from that pinned upstream revision.
The integration test converts the official receiver vectors into structured inputs, outpoints,
and taproot output keys before invoking the Rust API. The official receiver vectors do not carry
chain-facing UTXO amounts or outpoints for every output, so the test harness uses deterministic
synthetic metadata only for passthrough/mapping assertions; cryptographic match assertions remain
against the official output keys and receiver expectations.

This Phase 1 crate is not a complete wallet integration claim. Production compliance still
requires the Phase 2 transaction parser, eligibility rules, JNI/Kotlin wiring, chain/block-filter
feed, and end-to-end address/UTXO handling.
