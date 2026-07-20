# Silent Payments (BIP-352)

This change adds the production-facing native scanning slice for Conxius Wallet. Android owns
bounded Esplora ingestion, BIP-352 eligibility extraction, native scanning, public UTXO
persistence, cursor/resume, and shallow-reorg fail-closed checks. It does **not** add block-filter
discovery, spending/tweak recovery, or native silent-payment address encoding.

For the host-only Rust-versus-TypeScript scan comparison required by issue #355, see the
[silent-payment host microbenchmark](../benchmarks/silent-payments-issue-355.md). Its results are
limited to the platform-neutral Rust core and do not claim Android/JNI/mobile performance.

The shipped Android launcher remains a native Compose `FragmentActivity`, not a Capacitor
`BridgeActivity`. The `SilentPaymentPlugin` is compiled as an explicit, secret-free bridge
component for a future Capacitor host; it is not reachable from the current launcher and is not
claimed as registered by the generated Capacitor plugin asset.

## Production data flow

```text
Native Compose UI or a future Capacitor host (public options only)
        |
        v
application-scoped SilentPaymentScanCoordinator
        |-- unlock/session gate
        |-- EsploraBlockSource (fixed HTTPS endpoint allowlist)
        |-- SilentPaymentManager (SPB1 + native JNI)
        |-- RoomWalletSeedProvider (Room ciphertext -> StrongBox bytes -> callback)
        |-- Room atomic match/cursor persistence
        v
public UTXOs + metrics + cursor + structured state
```

JavaScript can request only `{ network, startHeight?, endHeight }`. It cannot provide an endpoint,
mnemonic, passphrase, seed, scan key, spend key, private key, or xpriv. Android rejects legacy
secret-bearing fields and exposes stable error codes only.

Production labels are not configured in this slice. Esplora batches therefore carry no labels, and
the Kotlin production manager rejects non-empty label lists with `INVALID_REQUEST` instead of
silently ignoring them. Room stores only the encrypted mnemonic bytes; BIP39 passphrases are not
stored or supplied by the production seed provider, and a non-empty passphrase is rejected at the
manager boundary. Native fixture/vector seams may still exercise protocol labels and passphrases;
that is not production end-to-end support.

### Esplora source and endpoint policy

`EsploraBlockSource` fetches the current tip, the canonical parent anchor for the first requested
block, then each block hash, block summary, canonical `/block/{hash}/txids` list, and transaction
pages in ascending height/order. The inclusive range is limited to 2,016 blocks; each response is
bounded before JSON parsing/allocation. Pagination uses the deterministic Esplora
`/block/{hash}/txs/{start_index}` convention with a maximum page size of 25, exact page lengths,
canonical txid/order cross-checks, and a maximum of 100,000 transactions per block. Only HTTPS endpoints on the fixed `blockstream.info` or
`mempool.space` host allowlist are accepted (mainnet, testnet, and signet); regtest has no public
endpoint and fails with `INVALID_NETWORK`.

The parser emits canonical transaction identities and non-overlapping ordered batches. It keeps
all input outpoints in txid little-endian form, but includes an input public key in the BIP-352
eligible set only for compressed P2PKH, P2WPKH, P2SH-P2WPKH, and x-only P2TR prevouts, with the
script commitment/hash checked before inclusion. Valid v0 P2WSH and other non-eligible inputs are
retained in the full outpoint list but do not reject the transaction; SegWit versions above the
BIP-352-supported range, malformed v0/v1 programs, malformed eligible witnesses/scripts, duplicate
input outpoints, and malformed transaction records are skipped or fail closed at the source
boundary. Diagnostics are bounded to a count and at most 32 non-sensitive reason codes. P2TR
script-path inputs are eligible via their output key after annex normalization except when the
control block commits to the BIP-341 NUMS internal key; that exception is skipped. P2PKH
scriptSigs are scanned for a compressed public-key push even when the script is non-standard, as
required by BIP-352. Transactions with no eligible input or no v1/32-byte Taproot output are
skipped before native scanning. Output value, txid/vout, and source spentness metadata are
retained when Esplora provides them; otherwise spentness is persisted as `UNKNOWN`, never guessed
as authoritative.

The Esplora JSON is allowlisted and treated as trusted chain metadata after the bounded shape,
range, order, and cross-record checks above. This slice does not fetch and cryptographically verify
raw transaction serialization or independently prove that the JSON transaction id commits to the
reported bytes. Spentness is likewise metadata, not a cryptographic proof of current UTXO state.

When the requested range reaches the observed tip, the source re-fetches both tip height and hash
before emitting the final block checkpoint. Any parent, txid/order, tip, or block continuity
mismatch fails closed and prevents cursor advancement.

The source records the range, current tip height/hash, block hash, previous block hash, block
height, and batch offset in Kotlin metadata adjacent to the SPB1 payload. This metadata is not
secret and is not inserted into the Rust wire format.

### Unlock and security boundary

`WalletSession` is an application-scoped authenticated/unlocked gate. `RoomWalletSeedProvider`
reads encrypted seed bytes through `WalletRepository`, decrypts with `StrongBoxManager`, and
borrows mutable bytes only for the manager callback. The provider and manager both clear mutable
buffers in `finally`; the provider never creates a mnemonic `String`, caches seed material, or
logs it. The existing BDK unlock path still has one documented bounded `String` conversion because
its current API accepts a mnemonic string; silent-payment scanning does not use that path.

No scan key, spend key, passphrase, mnemonic, shared secret, private tweak, xpriv, or public batch
blob containing secrets is persisted or serialized to JavaScript.

### Persistence, resume, and reorg behavior

Room schema version 3 adds:

- `silent_payment_utxos`, keyed by `(network, canonical display outpoint)` and containing only
  public match metadata, provenance, block/transaction identity, value, output key, and explicit
  `UNSPENT`/`SPENT`/`UNKNOWN` state.
- `silent_payment_scan_cursor`, keyed by network and containing the last durably scanned height and
  block hash.

The 2-to-3 migration is additive and non-destructive. Match upserts and final-block cursor updates
run in one Room transaction. A non-final batch may be safely replayed; the cursor advances only
after the final batch of a block commits. On resume, the coordinator requires the next height to be
the stored cursor plus one, checks the stored hash/previous hash relationship, and rejects hash or
ordering mismatches with `REORG_DETECTED`. It does not roll back already persisted rows or attempt
deep reorg recovery in this slice; operators must rescan from a trusted height after a reorg.

Reorg handling is therefore detection and fail-closed cursor protection, not automatic rollback or
rewind. Existing rows are not deleted when a reorg is detected.

## Boundary and key handling

- `native/silent-payments` is platform-neutral BIP-352 receiver-scan logic.
- `native/silent-payments-jni` is a separate `cdylib` JNI wrapper and binary protocol codec.
- `android/core-bitcoin` owns typed DTOs, `BlockSource`, the `WalletSeedProvider` callback, the
  native loader, and the suspend scanning loop.
- TypeScript does not pass a scan private key to a production native API. The Capacitor plugin has
  no secret-bearing scan method in this phase.
- The Kotlin provider supplies short-lived mnemonic bytes only around the JNI call. The manager and
  provider clear borrowed arrays in `finally`; provider implementations must also clear their own
  copies and never retain or log them. The production Room provider does not convert mnemonic bytes
  to an immutable `String`.

Rust derives the keys internally using the fixed canonical paths:

- Scan: `m/352'/coin_type'/account'/1'/0`
- Spend: `m/352'/coin_type'/account'/0'/0`

The only supported account is `0`. Network-to-coin mapping is explicit: mainnet uses coin type
`0`; testnet, signet, and regtest use coin type `1`. Unknown network values are rejected.

## Versioned binary ABI

The JNI method is the static method `NativeSilentPayments.nativeScan`:

```text
handle = nativeCreateCancellationHandle()
nativeScan(mnemonicBytes, passphraseBytes, publicBatchBytes, handle) -> resultBytes
nativeCancel(handle)
nativeDestroyCancellationHandle(handle)
```

Secret arrays and the public batch are separate JNI arguments. An empty passphrase array means no
passphrase. Kotlin invokes the blocking call on `Dispatchers.IO`, registers coroutine cancellation
against `nativeCancel`, and destroys the handle in `finally`. Cancellation is cooperative between
transactions and inside the bounded BIP-352 `k` loop; it cannot interrupt one secp256k1 primitive.
The method returns a result envelope, never a key or mnemonic.

### Public batch (`SPB1`, version 2)

All integer fields are little-endian. The batch begins with:

```text
magic[4] = "SPB1"
version:u8 = 2
network:u8 (0 mainnet, 1 testnet, 2 signet, 3 regtest)
account:u32 (must be 0)
start_block:u64
end_block:u64
transaction_count:u32
label_count:u32
labels[label_count]:u32
```

Each transaction contains `transaction_id[32]`, its block height/index, counts, every input
outpoint, eligible input references plus compressed/x-only public keys, and taproot outputs with
public mapping metadata. The transaction identity is the tuple
`(transaction_id, block_height, transaction_index)`, not a block/index lookup.
Outpoints use `txid_little_endian[32] || vout:u32`. No secret material is part of this format.

The decoder validates the whole byte limit before allocation, then validates each bounded count
before allocating a per-record collection. Current limits are 8 MiB per batch, 1,024
transactions, 4,096 inputs/eligible inputs/outputs per transaction, 65,536 total outputs, and
256 labels. Every `u64` is restricted to `0..=Long.MAX_VALUE` so Rust and Kotlin have the same
representable range. Before key derivation, the native boundary also estimates the deterministic
ECC/search work implied by input count, output count, `k` iterations, and label checks; a
pathological but structurally valid request returns the existing `RESOURCE_LIMIT` error before
expensive point operations begin.

### Result (`SPR1`, version 2)

Success envelopes contain the stable public metrics
`transaction_count`, `scanned_transaction_count`, `skipped_transaction_count`, `match_count`,
`elapsed_micros`, and `batch_bytes`, followed by public matches. Each match contains block/tx
identity (including `transaction_id`), output index/key, outpoint, amount, unspent flag, `k`,
label/unlabeled kind, and the negated-output flag.

Failure envelopes contain only one stable code:

```text
1 INVALID_SECRET
2 INVALID_NETWORK
3 INVALID_PUBLIC_BATCH
4 RESOURCE_LIMIT
5 INVALID_PUBLIC_RECORD
6 ECC_FAILURE
7 INTERNAL
8 CANCELLED
9 REORG_DETECTED
10 WALLET_LOCKED
11 INVALID_REQUEST
12 NETWORK_UNAVAILABLE
13 UNSUPPORTED_PLATFORM
```

Malformed or truncated envelopes fail closed. Rust catches panics at the JNI boundary so no panic
crosses FFI. Null JNI arrays, invalid handles, pending JNI access exceptions, and malformed public
records return a stable non-secret envelope when the JVM can allocate it. If result-array
allocation itself fails, JNI returns null because it cannot safely manufacture another Java array;
callers must treat that as an internal/native boundary failure rather than as a stable protocol
error.

## Shared validation table

Rust and Kotlin intentionally mirror this table before ECC work or unbounded allocation:

| Field/record | Rule | Failure |
| --- | --- | --- |
| Batch/result bytes | Batch `<= 8 MiB`; result `<= 16 MiB`; no trailing bytes | `RESOURCE_LIMIT` / `INVALID_PUBLIC_BATCH` |
| Batch transactions | `transaction_count <= 1,024`; aggregate manager call `<= 8,192` | `RESOURCE_LIMIT` |
| Inputs/outputs/labels | Inputs `<= 4,096`; eligible inputs `<= 4,096`; outputs `<= 4,096` per transaction; total outputs `<= 65,536`; labels `<= 256` and unique | `RESOURCE_LIMIT` / `INVALID_PUBLIC_RECORD` |
| Unsigned values | Every `u64` is `0..=Long.MAX_VALUE`; `u32` fields fit their declared Kotlin `Long` representation | `INVALID_PUBLIC_BATCH` / `INVALID_PUBLIC_RECORD` |
| Transaction identity | `(txid, block_height, transaction_index)` is unique within a batch | `INVALID_PUBLIC_RECORD` |
| Input records | Full input outpoints are unique; every eligible outpoint exists in full inputs; eligible references are unique | `INVALID_PUBLIC_RECORD` |
| Output records | Output outpoint txid equals transaction id; output outpoints and vouts are unique | `INVALID_PUBLIC_RECORD` |
| Result references | Match transaction identity exists; output index `< 4,096`; output outpoint txid equals transaction id; `(txid, block, index, output_index, outpoint)` is unique | `INVALID_PUBLIC_RECORD` |
| BIP-352 bounds | `0 <= k < K_MAX` where `K_MAX = 2,323`; `scanned + skipped == transaction_count`; match count equals encoded matches | `INVALID_PUBLIC_RECORD` / `INVALID_PUBLIC_BATCH` |

The Kotlin manager repeats identity/output checks after decoding so a native result cannot associate a
match with an ambiguous block/index pair or with a different public batch.

## Build and packaging

The app source set reads generated JNI libraries from:
`android/app/build/generated/silent-payments/jniLibs/`.

Normal Gradle configuration does not require the native toolchain. Debug and release prebuild,
package, and bundle tasks depend on `verifySilentPaymentsNative`, which first cleans the generated
directory, builds both required ABIs, and verifies non-empty libraries. Configuration-only Gradle
tasks do not invoke cargo. Invoke the explicit task when native packaging is wanted:

```bash
cd android
./gradlew :app:buildSilentPaymentsNative
```

The task calls `scripts/build-silent-payments-android.sh`, which requires:

- Rust/cargo and `cargo-ndk` (`cargo install cargo-ndk`)
- an Android NDK exposed through `ANDROID_NDK_HOME`/`ANDROID_NDK_ROOT` or an Android SDK through
  `ANDROID_HOME`/`ANDROID_SDK_ROOT`
- Rust targets `aarch64-linux-android` and `x86_64-linux-android`

Generated `.so` files and build directories are ignored and must not be committed.

The TypeScript `scanForSilentPayments` contract accepts public options and returns public UTXOs,
metrics, and cursor data. It deduplicates only validated canonical display outpoints, maps native
failures to a fixed stable-code set, and throws `Silent-payment scanning is unsupported on the web
platform.` on web builds. `SilentPaymentPlugin` also exposes cancellation and status methods, with
the completed status shape matching the top-level result shape. Removed secret-bearing Capacitor
methods are not restored: mnemonic/passphrase handling stays in the Android Room/StrongBox/provider
boundary. Because the current launcher is not a Capacitor host, this contract is not an assertion
that the plugin is currently callable from the shipped Compose activity. The current Compose
launcher cannot call the Capacitor plugin, so the public TypeScript codec and API types must not be
represented as full end-to-end TypeScript runtime support.

## Verification

Host Rust verification does not require a JVM, Android SDK, NDK, or Android Rust target:

```bash
cargo fmt --manifest-path native/silent-payments/Cargo.toml -- --check
cargo fmt --manifest-path native/silent-payments-jni/Cargo.toml -- --check
cargo test --manifest-path native/silent-payments/Cargo.toml --all-targets
cargo test --manifest-path native/silent-payments-jni/Cargo.toml --all-targets
cargo clippy --manifest-path native/silent-payments/Cargo.toml --all-targets -- -D warnings
cargo clippy --manifest-path native/silent-payments-jni/Cargo.toml --all-targets -- -D warnings
```

The Kotlin unit tests use fake HTTP/native seams and an in-memory `BlockSource`; they do not require
a `.so`. Room migration/DAO execution and Android compilation still require a valid Android SDK,
Gradle Android plugin environment, and (for packaged native libraries) the NDK/cargo-ndk toolchain.

## Honest scope and remaining limitations

- Native silent-payment spending, private tweak recovery, and address encoding are not implemented
  by this slice. The UI renders an unavailable address/key state instead of fabricating output.
- Esplora is a full transaction scan, not a compact-filter scan; bandwidth and scan time are
  bounded per request but may still be substantial over a large range.
- Esplora transaction output records do not always include authoritative spentness. Such matches are
  retained with `spentnessKnown=false` and `spentState=UNKNOWN`; a later UTXO-specific source is
  required for reliable spent-output discovery.
- Reorg handling is intentionally shallow and fail-closed. The coordinator detects cursor/hash
  mismatches and does not silently advance, but it does not delete or rewind rows automatically.
- Android SDK/NDK availability is a build-environment requirement. Host Rust and TypeScript checks
  can run without it; Android/Room compilation must be reported as blocked when those tools are
  absent rather than represented as passing.
