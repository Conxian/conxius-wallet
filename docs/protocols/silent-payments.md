# Silent Payments (BIP-352)

This change adds the secure native scanning slice for Conxius Wallet. It scans **supplied,
already-parsed structured transactions**; it does not claim full chain ingestion, Esplora
pagination, block-filter discovery, persistence, reorg handling, or address derivation.

## Boundary and key handling

- `native/silent-payments` is platform-neutral BIP-352 receiver-scan logic.
- `native/silent-payments-jni` is a separate `cdylib` JNI wrapper and binary protocol codec.
- `android/core-bitcoin` owns typed DTOs, `BlockSource`, the `WalletSeedProvider` callback, the
  native loader, and the suspend scanning loop.
- TypeScript does not pass a scan private key to a production native API. The Capacitor plugin has
  no secret-bearing scan method in this phase.
- The Kotlin provider supplies a short-lived UTF-8 BIP39 mnemonic and optional UTF-8 passphrase
  only around the JNI call. The manager clears both arrays in `finally`; provider implementations
  must also clear their own copies and never retain or log them.

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
representable range.

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

The TypeScript `scanForSilentPayments` compatibility symbol now throws an explicit unsupported
error rather than returning `[]`. Callers must migrate to Kotlin
`SilentPaymentManager.scanForPayments(BlockSource)`. Removed secret-bearing Capacitor methods are
not restored: mnemonic/passphrase handling stays in the Android provider/Keystore boundary.

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

The Kotlin unit tests use a fake native scanner seam and an in-memory `BlockSource`; they do not
require a `.so`. Android compilation still requires a valid Android SDK.
