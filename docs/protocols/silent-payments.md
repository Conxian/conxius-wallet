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
nativeScan(mnemonicBytes, passphraseBytes, publicBatchBytes) -> resultBytes
```

Secret arrays and the public batch are separate JNI arguments. An empty passphrase array means no
passphrase. The method returns a result envelope, never a key or mnemonic.

### Public batch (`SPB1`, version 1)

All integer fields are little-endian. The batch begins with:

```text
magic[4] = "SPB1"
version:u8 = 1
network:u8 (0 mainnet, 1 testnet, 2 signet, 3 regtest)
account:u32 (must be 0)
start_block:u64
end_block:u64
transaction_count:u32
label_count:u32
labels[label_count]:u32
```

Each transaction contains its block height/index, counts, every input outpoint, eligible input
references plus compressed/x-only public keys, and taproot outputs with public mapping metadata.
Outpoints use `txid_little_endian[32] || vout:u32`. No secret material is part of this format.

The decoder validates the whole byte limit before allocation, then validates each bounded count
before allocating a per-record collection. Current limits are 8 MiB per batch, 1,024
transactions, 4,096 inputs/eligible inputs/outputs per transaction, 65,536 total outputs, and
256 labels.

### Result (`SPR1`, version 1)

Success envelopes contain the stable public metrics
`transaction_count`, `scanned_transaction_count`, `skipped_transaction_count`, `match_count`,
`elapsed_micros`, and `batch_bytes`, followed by public matches. Each match contains block/tx
identity, output index/key, outpoint, amount, unspent flag, `k`, label/unlabeled kind, and the
negated-output flag.

Failure envelopes contain only one stable code:

```text
1 INVALID_SECRET
2 INVALID_NETWORK
3 INVALID_PUBLIC_BATCH
4 RESOURCE_LIMIT
5 INVALID_PUBLIC_RECORD
6 ECC_FAILURE
7 INTERNAL
```

Malformed or truncated envelopes fail closed. Rust catches panics at the JNI boundary so no panic
crosses FFI.

## Build and packaging

The app source set reads generated JNI libraries from:
`android/app/build/generated/silent-payments/jniLibs/`.

Normal Gradle configuration does not require the native toolchain. Invoke the explicit task when
native packaging is wanted:

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
