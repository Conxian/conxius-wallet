# Silent Payments (BIP-352)

Conxius Wallet is implementing BIP-352 support for static, non-linkable Bitcoin receive
addresses. Phase 1 establishes the independently testable native receiver-scan core; full wallet
integration is intentionally deferred to Phase 2.

## Architecture

Silent Payments follow the **Bridged Sovereign Architecture**:

1. **TS Layer**: Handles BIP-32 key derivation (m/352') and high-level UX.
2. **Rust Phase 1 core**: `native/silent-payments` scans already-parsed transaction records
   deterministically, with no network, filesystem, JSON, JNI, or Android Keystore access.
3. **Kotlin/Enclave**: `SilentPaymentManager.kt` remains fail-closed until Phase 2 JNI wiring
   routes scan operations through the Android Keystore-backed secret boundary.

## Key Derivation

- **Scan Key**: `m/352'/0'/0'/10/0`
- **Spend Key**: `m/352'/0'/0'/10/1`

## Phase 1 receiver scan core

`scan_transaction` accepts all transaction input outpoints, eligible input public keys, taproot
output keys plus mapping metadata, and labels. It selects the lexicographically smallest
serialized transaction outpoint, sums eligible input keys, computes the BIP-352 tagged hashes,
checks unlabeled and labeled output tweaks, supports output-key negation, and enforces `K_MAX =
2323`.

The official Bitcoin BIPs send/receive vectors are vendored under
`native/silent-payments/tests/data/` and exercised by the Rust integration test. Run:

```bash
cargo test --manifest-path native/silent-payments/Cargo.toml --all-targets
```

This documentation does not claim complete production BIP-352 compliance until the transaction
parser, chain feed, JNI/Kotlin boundary, and end-to-end UTXO integration are implemented.

## Security guards

All native scanning operations are protected by `ProductionRuntimeGuard.failClosed()` while the
Kotlin/Android integration remains fail-closed.

---
*Phase 1 native core verified against the pinned official BIP-352 vectors.*
